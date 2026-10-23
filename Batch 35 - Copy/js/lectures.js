/**
 * ==============================================================================
 * BATCH 35 — BSSE (Afternoon) — CLASS HUB
 * Lecture Management Module
 * ==============================================================================
 */

let allLecturesCache = [];

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await window.CLASS_HUB_AUTH.requireAuth(["student", "admin", "head_admin"]);
  if (!profile) return;

  await loadSubjectsFilter();
  await loadLectures();

  setupFilterHandlers();
  setupLectureForm();
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
    const formSelect = document.getElementById("lecture-subject");

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
    console.error("Error loading subjects for lectures:", err);
  }
}

// 2. Load lectures from Supabase
async function loadLectures() {
  const container = document.getElementById("lectures-list");
  if (!container) return;

  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><span>Loading lectures...</span></div>`;

  try {
    const { data: lectures, error } = await window.supabaseClient
      .from("lectures")
      .select(`
        id,
        lecture_number,
        title,
        description,
        lecture_date,
        subject_id,
        section_type,
        file_path,
        external_url,
        created_at,
        subjects(name, code)
      `)
      .order("lecture_number", { ascending: true });

    if (error) throw error;

    allLecturesCache = lectures || [];
    renderFilteredLectures();
  } catch (err) {
    console.error("Error loading lectures:", err);
    container.innerHTML = `<p class="form-helper">Failed to load lectures.</p>`;
  }
}

// 3. Render filtered lectures
function renderFilteredLectures() {
  const container = document.getElementById("lectures-list");
  if (!container) return;

  const subjectFilter = document.getElementById("filter-subject")?.value || "";
  const sectionFilter = document.getElementById("filter-section")?.value || "";
  const searchQuery = (document.getElementById("search-lectures")?.value || "").toLowerCase().trim();

  const filtered = allLecturesCache.filter(lec => {
    if (subjectFilter && lec.subject_id !== subjectFilter) return false;
    if (sectionFilter && lec.section_type !== sectionFilter) return false;
    if (searchQuery) {
      const titleMatch = lec.title.toLowerCase().includes(searchQuery);
      const descMatch = (lec.description || "").toLowerCase().includes(searchQuery);
      if (!titleMatch && !descMatch) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📖</div>
        <h3>No lectures found</h3>
        <p>No lectures recorded matching your current filters.</p>
      </div>
    `;
    return;
  }

  const isAdminView = window.location.pathname.includes("/admin/") || window.location.pathname.includes("/head-admin/");

  container.innerHTML = filtered.map(lec => {
    const subjectCode = lec.subjects?.code || "Subject";

    return `
      <article class="card" style="margin-bottom:1rem;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.5rem;">
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
            <span class="badge badge-primary">${window.CLASS_HUB_UTILS.escapeHtml(subjectCode)}</span>
            <span class="section-pill">${lec.section_type.toUpperCase()}</span>
            <span class="badge badge-normal">Lecture #${lec.lecture_number}</span>
          </div>
          <time style="font-size:0.8rem;color:var(--text-light);">${window.CLASS_HUB_UTILS.formatDate(lec.lecture_date)}</time>
        </div>
        <h3 style="font-size:1.15rem;margin-bottom:0.4rem;">${window.CLASS_HUB_UTILS.escapeHtml(lec.title)}</h3>
        ${lec.description ? `<p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.85rem;">${window.CLASS_HUB_UTILS.escapeHtml(lec.description)}</p>` : ""}
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border);">
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
            ${lec.file_path ? `
              <a href="${window.CLASS_HUB_UTILS.escapeHtml(lec.file_path)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary">
                Download Lecture Notes &darr;
              </a>
            ` : ""}
            ${lec.external_url ? `
              <a href="${window.CLASS_HUB_UTILS.escapeHtml(lec.external_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline">
                External Link &rarr;
              </a>
            ` : ""}
          </div>
          ${isAdminView ? `
            <div style="display:flex;gap:0.5rem;">
              <button type="button" class="action-btn" onclick="openEditLectureModal('${lec.id}')">✏️ Edit</button>
              <button type="button" class="action-btn danger" onclick="deleteLecture('${lec.id}')">🗑️ Delete</button>
            </div>
          ` : ""}
        </div>
      </article>
    `;
  }).join("");
}

// 4. Setup filter listeners
function setupFilterHandlers() {
  document.getElementById("filter-subject")?.addEventListener("change", renderFilteredLectures);
  document.getElementById("filter-section")?.addEventListener("change", renderFilteredLectures);
  document.getElementById("search-lectures")?.addEventListener("input", renderFilteredLectures);
}

// 5. Admin Lecture Form
function setupLectureForm() {
  const form = document.getElementById("form-lecture");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector("button[type='submit']");
    const editId = document.getElementById("lecture-edit-id")?.value;

    const lectureNumber = parseInt(document.getElementById("lecture-number").value, 10);
    const title = document.getElementById("lecture-title").value.trim();
    const description = document.getElementById("lecture-desc").value.trim();
    const subjectId = document.getElementById("lecture-subject").value;
    const sectionType = document.getElementById("lecture-section").value;
    const lectureDate = document.getElementById("lecture-date").value;
    const filePath = document.getElementById("lecture-file-url")?.value.trim() || null;
    const externalUrl = document.getElementById("lecture-external-url")?.value.trim() || null;

    if (!lectureNumber || !title || !subjectId || !sectionType || !lectureDate) {
      window.CLASS_HUB_UTILS.showToast("Please fill in all required fields.", "warning");
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner spinner-sm spinner-light"></span> Saving...`;

      const user = await window.CLASS_HUB_AUTH.getCurrentUser();

      if (editId) {
        const { error } = await window.supabaseClient
          .from("lectures")
          .update({
            lecture_number: lectureNumber,
            title,
            description,
            subject_id: subjectId,
            section_type: sectionType,
            lecture_date: lectureDate,
            file_path: filePath,
            external_url: externalUrl,
            updated_at: new Date().toISOString()
          })
          .eq("id", editId);

        if (error) throw error;
        window.CLASS_HUB_UTILS.showToast("Lecture updated successfully!", "success");
      } else {
        const { error } = await window.supabaseClient
          .from("lectures")
          .insert({
            lecture_number: lectureNumber,
            title,
            description,
            subject_id: subjectId,
            section_type: sectionType,
            lecture_date: lectureDate,
            file_path: filePath,
            external_url: externalUrl,
            created_by: user.id
          });

        if (error) throw error;
        window.CLASS_HUB_UTILS.showToast("Lecture added successfully!", "success");
      }

      form.reset();
      if (document.getElementById("lecture-edit-id")) {
        document.getElementById("lecture-edit-id").value = "";
      }
      window.CLASS_HUB_UTILS.closeModal("modal-lecture");
      await loadLectures();
    } catch (err) {
      console.error("Lecture save error:", err);
      window.CLASS_HUB_UTILS.showToast("Failed to save lecture.", "danger");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Save Lecture`;
    }
  });
}

// 6. Edit Lecture Modal
window.openEditLectureModal = function(id) {
  const lec = allLecturesCache.find(l => l.id === id);
  if (!lec) return;

  document.getElementById("lecture-edit-id").value = lec.id;
  document.getElementById("lecture-number").value = lec.lecture_number;
  document.getElementById("lecture-title").value = lec.title;
  document.getElementById("lecture-desc").value = lec.description || "";
  document.getElementById("lecture-subject").value = lec.subject_id;
  document.getElementById("lecture-section").value = lec.section_type;
  document.getElementById("lecture-date").value = lec.lecture_date;
  if (document.getElementById("lecture-file-url")) {
    document.getElementById("lecture-file-url").value = lec.file_path || "";
  }
  if (document.getElementById("lecture-external-url")) {
    document.getElementById("lecture-external-url").value = lec.external_url || "";
  }

  document.getElementById("modal-lecture-title").textContent = "Edit Lecture";
  window.CLASS_HUB_UTILS.openModal("modal-lecture");
};

// 7. Delete Lecture
window.deleteLecture = async function(id) {
  if (!confirm("Are you sure you want to delete this lecture entry?")) return;

  try {
    const { error } = await window.supabaseClient
      .from("lectures")
      .delete()
      .eq("id", id);

    if (error) throw error;

    window.CLASS_HUB_UTILS.showToast("Lecture deleted.", "success");
    await loadLectures();
  } catch (err) {
    console.error("Delete lecture error:", err);
    window.CLASS_HUB_UTILS.showToast("Failed to delete lecture.", "danger");
  }
};
