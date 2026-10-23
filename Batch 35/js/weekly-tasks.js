/**
 * ==============================================================================
 * BATCH 35 — BSSE (Afternoon) — CLASS HUB
 * Weekly Tasks & Deadlines Controller
 * ==============================================================================
 */

let allTasksCache = [];

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await window.CLASS_HUB_AUTH.requireAuth(["student", "admin", "head_admin"]);
  if (!profile) return;

  await loadSubjectsFilter();
  await loadWeeklyTasks();

  setupFilterHandlers();
  setupTaskForm();
});

// 1. Populate Subject dropdown
async function loadSubjectsFilter() {
  try {
    const { data: subjects, error } = await window.supabaseClient
      .from("subjects")
      .select("id, name, code")
      .eq("is_active", true)
      .order("code", { ascending: true });

    if (error) throw error;

    const filterSelect = document.getElementById("filter-subject");
    const formSelect = document.getElementById("task-subject");

    const options = (subjects || []).map(s => 
      `<option value="${s.id}">${window.CLASS_HUB_UTILS.escapeHtml(s.code)} — ${window.CLASS_HUB_UTILS.escapeHtml(s.name)}</option>`
    ).join("");

    if (filterSelect) {
      filterSelect.innerHTML = `<option value="">All Subjects</option>` + options;
    }
    if (formSelect) {
      formSelect.innerHTML = `<option value="" disabled selected>Select Subject</option>` + options;
    }
  } catch (err) {
    console.error("Error loading subjects for tasks:", err);
  }
}

// 2. Load Tasks from database
async function loadWeeklyTasks() {
  const container = document.getElementById("tasks-list");
  if (!container) return;

  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><span>Loading tasks...</span></div>`;

  try {
    const { data: tasks, error } = await window.supabaseClient
      .from("weekly_tasks")
      .select(`
        id,
        title,
        description,
        subject_id,
        section_type,
        task_type,
        due_date,
        priority,
        status,
        resource_url,
        created_at,
        subjects(name, code)
      `)
      .order("due_date", { ascending: true });

    if (error) throw error;

    allTasksCache = tasks || [];
    renderFilteredTasks();
  } catch (err) {
    console.error("Error loading tasks:", err);
    container.innerHTML = `<p class="form-helper">Failed to load tasks.</p>`;
  }
}

// 3. Render filtered tasks
function renderFilteredTasks() {
  const container = document.getElementById("tasks-list");
  if (!container) return;

  const subjectFilter = document.getElementById("filter-subject")?.value || "";
  const statusFilter = document.getElementById("filter-status")?.value || "Active";
  const typeFilter = document.getElementById("filter-type")?.value || "";
  const searchQuery = (document.getElementById("search-tasks")?.value || "").toLowerCase().trim();

  const filtered = allTasksCache.filter(task => {
    if (statusFilter !== "All" && task.status !== statusFilter) return false;
    if (subjectFilter && task.subject_id !== subjectFilter) return false;
    if (typeFilter && task.task_type !== typeFilter) return false;
    if (searchQuery) {
      const titleMatch = task.title.toLowerCase().includes(searchQuery);
      const descMatch = (task.description || "").toLowerCase().includes(searchQuery);
      if (!titleMatch && !descMatch) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>No tasks found</h3>
        <p>No tasks match your chosen filters.</p>
      </div>
    `;
    return;
  }

  const isAdminView = window.location.pathname.includes("/admin/") || window.location.pathname.includes("/head-admin/");

  container.innerHTML = filtered.map(task => {
    const isOverdue = window.CLASS_HUB_UTILS.isDateOverdue(task.due_date);
    const subjectCode = task.subjects?.code || "Course";
    const dueFormatted = window.CLASS_HUB_UTILS.formatDateTime(task.due_date);

    return `
      <div class="task-item">
        <div class="task-left">
          <span class="task-type-badge">${window.CLASS_HUB_UTILS.escapeHtml(task.task_type)}</span>
          <div class="task-info">
            <h4>${window.CLASS_HUB_UTILS.escapeHtml(task.title)}</h4>
            <div class="task-meta">
              <span class="badge badge-primary">${window.CLASS_HUB_UTILS.escapeHtml(subjectCode)}</span>
              ${task.section_type ? `<span class="section-pill">${task.section_type.toUpperCase()}</span>` : ""}
              <span class="task-due ${isOverdue && task.status === 'Active' ? 'overdue' : ''}">
                ⏰ ${isOverdue && task.status === 'Active' ? 'OVERDUE: ' : 'Due: '}${dueFormatted}
              </span>
              <span class="badge badge-normal">${window.CLASS_HUB_UTILS.escapeHtml(task.priority)}</span>
              <span class="status-pill ${task.status === 'Active' ? 'active' : 'inactive'}">${task.status}</span>
            </div>
            ${task.description ? `<p style="font-size:0.85rem;color:var(--text-muted);margin-top:0.35rem;">${window.CLASS_HUB_UTILS.escapeHtml(task.description)}</p>` : ""}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
          ${task.resource_url ? `
            <a href="${window.CLASS_HUB_UTILS.escapeHtml(task.resource_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline">
              Attached Link &rarr;
            </a>
          ` : ""}
          ${isAdminView ? `
            <button type="button" class="action-btn" onclick="openEditTaskModal('${task.id}')">✏️ Edit</button>
            <button type="button" class="action-btn danger" onclick="deleteTask('${task.id}')">🗑️ Delete</button>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");
}

// 4. Setup filter listeners
function setupFilterHandlers() {
  document.getElementById("filter-subject")?.addEventListener("change", renderFilteredTasks);
  document.getElementById("filter-status")?.addEventListener("change", renderFilteredTasks);
  document.getElementById("filter-type")?.addEventListener("change", renderFilteredTasks);
  document.getElementById("search-tasks")?.addEventListener("input", renderFilteredTasks);
}

// 5. Admin Task Form
function setupTaskForm() {
  const form = document.getElementById("form-task");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector("button[type='submit']");
    const editId = document.getElementById("task-edit-id")?.value;

    const title = document.getElementById("task-title").value.trim();
    const description = document.getElementById("task-desc").value.trim();
    const subjectId = document.getElementById("task-subject").value;
    const sectionType = document.getElementById("task-section").value || null;
    const taskType = document.getElementById("task-type").value;
    const dueDate = document.getElementById("task-due").value;
    const priority = document.getElementById("task-priority").value;
    const status = document.getElementById("task-status")?.value || "Active";
    const resourceUrl = document.getElementById("task-link")?.value.trim() || null;

    if (!title || !subjectId || !taskType || !dueDate) {
      window.CLASS_HUB_UTILS.showToast("Please fill in required fields.", "warning");
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner spinner-sm spinner-light"></span> Saving...`;

      const user = await window.CLASS_HUB_AUTH.getCurrentUser();

      if (editId) {
        const { error } = await window.supabaseClient
          .from("weekly_tasks")
          .update({
            title,
            description,
            subject_id: subjectId,
            section_type: sectionType,
            task_type: taskType,
            due_date: new Date(dueDate).toISOString(),
            priority,
            status,
            resource_url: resourceUrl,
            updated_at: new Date().toISOString()
          })
          .eq("id", editId);

        if (error) throw error;
        window.CLASS_HUB_UTILS.showToast("Task updated successfully!", "success");
      } else {
        const { error } = await window.supabaseClient
          .from("weekly_tasks")
          .insert({
            title,
            description,
            subject_id: subjectId,
            section_type: sectionType,
            task_type: taskType,
            due_date: new Date(dueDate).toISOString(),
            priority,
            status: "Active",
            resource_url: resourceUrl,
            created_by: user.id
          });

        if (error) throw error;
        window.CLASS_HUB_UTILS.showToast("Task added to schedule!", "success");
      }

      form.reset();
      if (document.getElementById("task-edit-id")) {
        document.getElementById("task-edit-id").value = "";
      }
      window.CLASS_HUB_UTILS.closeModal("modal-task");
      await loadWeeklyTasks();
    } catch (err) {
      console.error("Task save error:", err);
      window.CLASS_HUB_UTILS.showToast("Failed to save task.", "danger");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Save Task`;
    }
  });
}

// 6. Open Edit Task Modal
window.openEditTaskModal = function(id) {
  const task = allTasksCache.find(t => t.id === id);
  if (!task) return;

  document.getElementById("task-edit-id").value = task.id;
  document.getElementById("task-title").value = task.title;
  document.getElementById("task-desc").value = task.description || "";
  document.getElementById("task-subject").value = task.subject_id;
  document.getElementById("task-section").value = task.section_type || "";
  document.getElementById("task-type").value = task.task_type;
  
  if (task.due_date) {
    // Format for datetime-local input (YYYY-MM-DDTHH:mm)
    const d = new Date(task.due_date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    document.getElementById("task-due").value = d.toISOString().slice(0, 16);
  }

  document.getElementById("task-priority").value = task.priority;
  if (document.getElementById("task-status")) {
    document.getElementById("task-status").value = task.status;
  }
  if (document.getElementById("task-link")) {
    document.getElementById("task-link").value = task.resource_url || "";
  }

  document.getElementById("modal-task-title").textContent = "Edit Weekly Task";
  window.CLASS_HUB_UTILS.openModal("modal-task");
};

// 7. Delete Task
window.deleteTask = async function(id) {
  if (!confirm("Are you sure you want to delete this task?")) return;

  try {
    const { error } = await window.supabaseClient
      .from("weekly_tasks")
      .delete()
      .eq("id", id);

    if (error) throw error;

    window.CLASS_HUB_UTILS.showToast("Task deleted.", "success");
    await loadWeeklyTasks();
  } catch (err) {
    console.error("Delete task error:", err);
    window.CLASS_HUB_UTILS.showToast("Failed to delete task.", "danger");
  }
};
