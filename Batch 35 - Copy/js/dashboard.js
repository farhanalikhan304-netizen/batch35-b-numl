/**
 * ==============================================================================
 * BATCH 35 — BSSE (Afternoon) — CLASS HUB
 * Student Dashboard Controller
 * ==============================================================================
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Enforce Student / Admin / Head Admin authentication
  const profile = await window.CLASS_HUB_AUTH.requireAuth(["student", "admin", "head_admin"]);
  if (!profile) return;

  // Set greeting with student's profile name
  const greetingEl = document.getElementById("welcome-greeting");
  if (greetingEl) {
    greetingEl.textContent = `Welcome back, ${profile.full_name}! Here is your class update.`;
  }

  // Display today's date formatted
  const todayDateEl = document.getElementById("today-date");
  if (todayDateEl) {
    const today = new Date();
    todayDateEl.textContent = today.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }

  // Load Dashboard Data in parallel
  loadWeeklySummary();
  loadRecentAnnouncements();
  loadUpcomingTasks();
  loadSubjectCards();
});

// 1. Load Weekly Summary Metrics
async function loadWeeklySummary() {
  const container = document.getElementById("weekly-summary-metrics");
  if (!container) return;

  try {
    const now = new Date();
    const oneWeekLater = new Date();
    oneWeekLater.setDate(now.getDate() + 7);

    // Fetch active tasks due within the next 7 days
    const { data: upcomingTasks, error: taskError } = await window.supabaseClient
      .from("weekly_tasks")
      .select("id, task_type")
      .eq("status", "Active")
      .gte("due_date", now.toISOString())
      .lte("due_date", oneWeekLater.toISOString());

    // Fetch announcements in the past 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    const { data: recentAnnouncements } = await window.supabaseClient
      .from("announcements")
      .select("id")
      .gte("published_at", sevenDaysAgo.toISOString());

    // Count specific task categories
    const tasksCount = upcomingTasks ? upcomingTasks.length : 0;
    const vivasCount = upcomingTasks ? upcomingTasks.filter(t => t.task_type === "Viva").length : 0;
    const labsCount = upcomingTasks ? upcomingTasks.filter(t => t.task_type === "Lab Report").length : 0;
    const announcementsCount = recentAnnouncements ? recentAnnouncements.length : 0;

    container.innerHTML = `
      <div class="summary-metric-item">
        <div class="metric-num">${tasksCount}</div>
        <div class="metric-text">Deadlines this Week</div>
      </div>
      <div class="summary-metric-item">
        <div class="metric-num">${vivasCount}</div>
        <div class="metric-text">Upcoming Vivas</div>
      </div>
      <div class="summary-metric-item">
        <div class="metric-num">${labsCount}</div>
        <div class="metric-text">Lab Submissions</div>
      </div>
      <div class="summary-metric-item">
        <div class="metric-num">${announcementsCount}</div>
        <div class="metric-text">New Updates</div>
      </div>
    `;
  } catch (err) {
    console.error("Error loading weekly summary:", err);
    container.innerHTML = `<p class="form-helper">Could not load weekly summary.</p>`;
  }
}

// 2. Load Recent Announcements
async function loadRecentAnnouncements() {
  const container = document.getElementById("recent-announcements-list");
  if (!container) return;

  try {
    const { data, error } = await window.supabaseClient
      .from("announcements")
      .select("id, title, description, priority, published_at, subjects(name, code)")
      .order("published_at", { ascending: false })
      .limit(5);

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📢</div>
          <h3>No announcements yet</h3>
          <p>Important class notices will appear here as soon as they are posted.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = data.map(item => {
      const priorityClass = item.priority.toLowerCase();
      const subjectTag = item.subjects ? `<span class="badge badge-primary">${window.CLASS_HUB_UTILS.escapeHtml(item.subjects.code)}</span>` : "";
      
      return `
        <article class="announcement-card ${priorityClass}">
          <div class="announcement-meta">
            <div style="display:flex;align-items:center;gap:0.5rem;">
              <span class="badge badge-${priorityClass}">${window.CLASS_HUB_UTILS.escapeHtml(item.priority)}</span>
              ${subjectTag}
            </div>
            <time style="font-size:0.8rem;color:var(--text-light);">${window.CLASS_HUB_UTILS.formatDate(item.published_at)}</time>
          </div>
          <h3 class="announcement-title">${window.CLASS_HUB_UTILS.escapeHtml(item.title)}</h3>
          <p class="announcement-desc">${window.CLASS_HUB_UTILS.escapeHtml(item.description)}</p>
        </article>
      `;
    }).join("");
  } catch (err) {
    console.error("Error loading announcements:", err);
    container.innerHTML = `<p class="form-helper">Failed to load announcements from database.</p>`;
  }
}

// 3. Load Upcoming Tasks
async function loadUpcomingTasks() {
  const container = document.getElementById("upcoming-tasks-list");
  if (!container) return;

  try {
    const { data, error } = await window.supabaseClient
      .from("weekly_tasks")
      .select("id, title, task_type, due_date, priority, status, resource_url, subjects(name, code)")
      .eq("status", "Active")
      .order("due_date", { ascending: true })
      .limit(5);

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <h3>No pending tasks</h3>
          <p>You're all caught up! No upcoming assignments or submissions.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = data.map(task => {
      const isOverdue = window.CLASS_HUB_UTILS.isDateOverdue(task.due_date);
      const subjectCode = task.subjects?.code || "General";
      const dueText = window.CLASS_HUB_UTILS.formatDateTime(task.due_date);

      return `
        <div class="task-item">
          <div class="task-left">
            <span class="task-type-badge">${window.CLASS_HUB_UTILS.escapeHtml(task.task_type)}</span>
            <div class="task-info">
              <h4>${window.CLASS_HUB_UTILS.escapeHtml(task.title)}</h4>
              <div class="task-meta">
                <span>📚 ${window.CLASS_HUB_UTILS.escapeHtml(subjectCode)}</span>
                <span class="task-due ${isOverdue ? 'overdue' : ''}">
                  ⏰ ${isOverdue ? 'Overdue: ' : 'Due: '}${dueText}
                </span>
                <span class="badge badge-normal">${window.CLASS_HUB_UTILS.escapeHtml(task.priority)} Priority</span>
              </div>
            </div>
          </div>
          ${task.resource_url ? `
            <a href="${window.CLASS_HUB_UTILS.escapeHtml(task.resource_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline">
              Open Material &rarr;
            </a>
          ` : ""}
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Error loading tasks:", err);
    container.innerHTML = `<p class="form-helper">Failed to load tasks from database.</p>`;
  }
}

// 4. Load Subject Cards
async function loadSubjectCards() {
  const container = document.getElementById("subjects-card-grid");
  if (!container) return;

  try {
    // Fetch subjects and their sections
    const { data: subjects, error } = await window.supabaseClient
      .from("subjects")
      .select(`
        id, 
        name, 
        code, 
        description,
        subject_sections(section_type, is_active)
      `)
      .eq("is_active", true)
      .order("code", { ascending: true });

    if (error) throw error;

    if (!subjects || subjects.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">📚</div>
          <h3>No subjects found</h3>
          <p>Academic subjects have not been configured in the database yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = subjects.map(sub => {
      // Collect active section tags (Theory, Lab)
      const sections = (sub.subject_sections || [])
        .filter(s => s.is_active)
        .map(s => `<span class="section-pill">${s.section_type.toUpperCase()}</span>`)
        .join("");

      return `
        <article class="subject-card">
          <div>
            <div class="subject-card-top">
              <span class="subject-code-badge">${window.CLASS_HUB_UTILS.escapeHtml(sub.code)}</span>
              <div class="subject-sections-tags">${sections}</div>
            </div>
            <div class="subject-card-body">
              <h3>${window.CLASS_HUB_UTILS.escapeHtml(sub.name)}</h3>
              <p class="subject-card-desc">${window.CLASS_HUB_UTILS.escapeHtml(sub.description || "No description provided.")}</p>
            </div>
          </div>
          <div class="subject-card-footer">
            <span style="font-size:0.8rem;color:var(--text-light);">Course Portal</span>
            <a href="subject.html?id=${sub.id}" class="btn btn-sm btn-primary">
              Open Subject &rarr;
            </a>
          </div>
        </article>
      `;
    }).join("");
  } catch (err) {
    console.error("Error loading subjects:", err);
    container.innerHTML = `<p class="form-helper">Failed to load subject cards.</p>`;
  }
}
