/**
 * ==============================================================================
 * BATCH 35 — BSSE (Afternoon) — CLASS HUB
 * Announcement Management Module
 * ==============================================================================
 */

let allAnnouncementsCache = [];

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await window.CLASS_HUB_AUTH.requireAuth(["student", "admin", "head_admin"]);
  if (!profile) return;

  await loadSubjectsFilter();
  await loadAnnouncements();

  setupFilterHandlers();
  setupAnnouncementForm();
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
    const formSelect = document.getElementById("announcement-subject");

    const options = (subjects || []).map(s => 
      `<option value="${s.id}">${window.CLASS_HUB_UTILS.escapeHtml(s.code)} — ${window.CLASS_HUB_UTILS.escapeHtml(s.name)}</option>`
    ).join("");

    if (filterSelect) {
      filterSelect.innerHTML = `<option value="">All Subjects</option>` + options;
    }
    if (formSelect) {
      formSelect.innerHTML = `<option value="">General (No specific subject)</option>` + options;
    }
  } catch (err) {
    console.error("Error loading subjects for announcements:", err);
  }
}

// 2. Load announcements from Supabase
async function loadAnnouncements() {
  const container = document.getElementById("announcements-list");
  if (!container) return;

  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><span>Loading announcements...</span></div>`;

  try {
    const { data, error } = await window.supabaseClient
      .from("announcements")
      .select(`
        id,
        title,
        description,
        priority,
        published_at,
        expires_at,
        subject_id,
        section_type,
        created_by,
        subjects(name, code)
      `)
      .order("published_at", { ascending: false });

    if (error) throw error;

    allAnnouncementsCache = data || [];
    renderFilteredAnnouncements();
  } catch (err) {
    console.error("Error loading announcements:", err);
    container.innerHTML = `<p class="form-helper">Failed to load announcements.</p>`;
  }
}

// 3. Render filtered announcements
function renderFilteredAnnouncements() {
  const container = document.getElementById("announcements-list");
  if (!container) return;

  const subjectFilter = document.getElementById("filter-subject")?.value || "";
  const priorityFilter = document.getElementById("filter-priority")?.value || "";
  const searchQuery = (document.getElementById("search-announcements")?.value || "").toLowerCase().trim();

  const filtered = allAnnouncementsCache.filter(item => {
    if (subjectFilter && item.subject_id !== subjectFilter) return false;
    if (priorityFilter && item.priority !== priorityFilter) return false;
    if (searchQuery) {
      const titleMatch = item.title.toLowerCase().includes(searchQuery);
      const descMatch = item.description.toLowerCase().includes(searchQuery);
      if (!titleMatch && !descMatch) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📢</div>
        <h3>No announcements found</h3>
        <p>No notices matching the selected criteria.</p>
      </div>
    `;
    return;
  }

  const isAdminView = window.location.pathname.includes("/admin/") || window.location.pathname.includes("/head-admin/");

  container.innerHTML = filtered.map(item => {
    const priorityClass = item.priority.toLowerCase();
    const subjectTag = item.subjects ? `<span class="badge badge-primary">${window.CLASS_HUB_UTILS.escapeHtml(item.subjects.code)}</span>` : `<span class="badge badge-normal">General</span>`;
    const sectionTag = item.section_type ? `<span class="section-pill">${item.section_type.toUpperCase()}</span>` : "";

    return `
      <article class="announcement-card ${priorityClass}">
        <div class="announcement-meta">
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
            <span class="badge badge-${priorityClass}">${window.CLASS_HUB_UTILS.escapeHtml(item.priority)}</span>
            ${subjectTag}
            ${sectionTag}
          </div>
          <time style="font-size:0.8rem;color:var(--text-light);">${window.CLASS_HUB_UTILS.formatDate(item.published_at)}</time>
        </div>
        <h3 class="announcement-title">${window.CLASS_HUB_UTILS.escapeHtml(item.title)}</h3>
        <p class="announcement-desc">${window.CLASS_HUB_UTILS.escapeHtml(item.description)}</p>
        ${isAdminView ? `
          <div style="margin-top:0.85rem;display:flex;gap:0.5rem;justify-content:flex-end;">
            <button type="button" class="action-btn" onclick="openEditAnnouncementModal('${item.id}')">✏️ Edit</button>
            <button type="button" class="action-btn danger" onclick="deleteAnnouncement('${item.id}')">🗑️ Delete</button>
          </div>
        ` : ""}
      </article>
    `;
  }).join("");
}

// 4. Setup filter handlers
function setupFilterHandlers() {
  document.getElementById("filter-subject")?.addEventListener("change", renderFilteredAnnouncements);
  document.getElementById("filter-priority")?.addEventListener("change", renderFilteredAnnouncements);
  document.getElementById("search-announcements")?.addEventListener("input", renderFilteredAnnouncements);
}

// 5. Admin Form: Create & Edit Announcement
function setupAnnouncementForm() {
  const form = document.getElementById("form-announcement");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector("button[type='submit']");
    const editId = document.getElementById("announcement-edit-id")?.value;

    const title = document.getElementById("announcement-title").value.trim();
    const description = document.getElementById("announcement-desc").value.trim();
    const subjectId = document.getElementById("announcement-subject").value || null;
    const sectionType = document.getElementById("announcement-section").value || null;
    const priority = document.getElementById("announcement-priority").value;
    const expiresAt = document.getElementById("announcement-expiry").value || null;

    if (!title || !description || !priority) {
      window.CLASS_HUB_UTILS.showToast("Please fill in all required fields.", "warning");
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner spinner-sm spinner-light"></span> Saving...`;

      const user = await window.CLASS_HUB_AUTH.getCurrentUser();

      if (editId) {
        // Update existing announcement
        const { error } = await window.supabaseClient
          .from("announcements")
          .update({
            title,
            description,
            subject_id: subjectId,
            section_type: sectionType,
            priority,
            expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq("id", editId);

        if (error) throw error;
        window.CLASS_HUB_UTILS.showToast("Announcement updated successfully!", "success");
      } else {
        // Create new announcement
        const { error } = await window.supabaseClient
          .from("announcements")
          .insert({
            title,
            description,
            subject_id: subjectId,
            section_type: sectionType,
            priority,
            expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
            created_by: user.id
          });

        if (error) throw error;
        window.CLASS_HUB_UTILS.showToast("Announcement published successfully!", "success");
      }

      form.reset();
      if (document.getElementById("announcement-edit-id")) {
        document.getElementById("announcement-edit-id").value = "";
      }
      window.CLASS_HUB_UTILS.closeModal("modal-announcement");
      await loadAnnouncements();
    } catch (err) {
      console.error("Announcement save error:", err);
      window.CLASS_HUB_UTILS.showToast("Failed to save announcement.", "danger");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Save Announcement`;
    }
  });
}

// 6. Edit Modal Opener
window.openEditAnnouncementModal = function(id) {
  const item = allAnnouncementsCache.find(a => a.id === id);
  if (!item) return;

  document.getElementById("announcement-edit-id").value = item.id;
  document.getElementById("announcement-title").value = item.title;
  document.getElementById("announcement-desc").value = item.description;
  document.getElementById("announcement-subject").value = item.subject_id || "";
  document.getElementById("announcement-section").value = item.section_type || "";
  document.getElementById("announcement-priority").value = item.priority;
  if (item.expires_at) {
    document.getElementById("announcement-expiry").value = item.expires_at.split("T")[0];
  } else {
    document.getElementById("announcement-expiry").value = "";
  }

  document.getElementById("modal-announcement-title").textContent = "Edit Announcement";
  window.CLASS_HUB_UTILS.openModal("modal-announcement");
};

// 7. Delete Announcement
window.deleteAnnouncement = async function(id) {
  if (!confirm("Are you sure you want to delete this announcement?")) return;

  try {
    const { error } = await window.supabaseClient
      .from("announcements")
      .delete()
      .eq("id", id);

    if (error) throw error;

    window.CLASS_HUB_UTILS.showToast("Announcement deleted.", "success");
    await loadAnnouncements();
  } catch (err) {
    console.error("Delete announcement error:", err);
    window.CLASS_HUB_UTILS.showToast("Failed to delete announcement.", "danger");
  }
};
