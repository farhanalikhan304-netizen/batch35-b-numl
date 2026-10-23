/**
 * ==============================================================================
 * BATCH 35 — BSSE (Afternoon) — CLASS HUB
 * Head Administrator Controller & Portal Configuration
 * ==============================================================================
 */

let adminsListCache = [];

document.addEventListener("DOMContentLoaded", async () => {
  // Only Head Admin is allowed to access these views
  const profile = await window.CLASS_HUB_AUTH.requireAuth(["head_admin"]);
  if (!profile) return;

  if (window.location.pathname.includes("dashboard.html")) {
    loadHeadAdminDashboard();
  } else if (window.location.pathname.includes("admins.html")) {
    loadAdminsManagement();
  } else if (window.location.pathname.includes("settings.html")) {
    loadPortalSettings();
  }
});

// 1. Load Head Admin Dashboard
async function loadHeadAdminDashboard() {
  try {
    const { data: stats, error } = await window.supabaseClient.rpc("get_portal_stats");
    if (!error && stats) {
      renderStatValue("head-stat-students", `${stats.active_students} / 40`);
      renderStatValue("head-stat-admins", `${stats.active_admins} / 9`);
      renderStatValue("head-stat-total", `${stats.total_active_accounts} / 50`);
      renderStatValue("head-stat-capacity", `${stats.remaining_capacity} Slots Left`);
      renderStatValue("head-stat-subjects", stats.total_subjects);
      renderStatValue("head-stat-documents", stats.total_documents);

      // Progress bar
      const studentBar = document.getElementById("head-bar-students");
      const adminBar = document.getElementById("head-bar-admins");
      const headAdminBar = document.getElementById("head-bar-head");

      if (studentBar) studentBar.style.width = `${(stats.active_students / 50) * 100}%`;
      if (adminBar) adminBar.style.width = `${(stats.active_admins / 50) * 100}%`;
      if (headAdminBar) headAdminBar.style.width = `${(stats.active_head_admins / 50) * 100}%`;
    }

    // Load recent administrative activity logs
    loadActivityLogs();
  } catch (err) {
    console.error("Head admin dashboard error:", err);
  }
}

// 2. Load Activity Logs Feed
async function loadActivityLogs() {
  const container = document.getElementById("activity-logs-list");
  if (!container) return;

  try {
    const { data: logs, error } = await window.supabaseClient
      .from("activity_logs")
      .select(`
        id,
        action,
        target_type,
        target_id,
        metadata,
        created_at,
        profiles(full_name, username)
      `)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!logs || logs.length === 0) {
      container.innerHTML = `<p class="form-helper">No recent administrative activity recorded.</p>`;
      return;
    }

    container.innerHTML = logs.map(log => {
      const actorName = log.profiles?.full_name || "Administrator";
      let icon = "⚡";
      if (log.action.includes("CREATE")) icon = "➕";
      else if (log.action.includes("RESET")) icon = "🔑";
      else if (log.action.includes("TOGGLE")) icon = "🔄";

      return `
        <div class="activity-item">
          <div class="activity-icon-badge">${icon}</div>
          <div class="activity-content">
            <div class="activity-title">
              <strong>${window.CLASS_HUB_UTILS.escapeHtml(actorName)}</strong> performed <code>${window.CLASS_HUB_UTILS.escapeHtml(log.action)}</code>
            </div>
            <div class="activity-time">${window.CLASS_HUB_UTILS.formatDateTime(log.created_at)}</div>
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Error loading activity logs:", err);
    container.innerHTML = `<p class="form-helper">Failed to load activity logs.</p>`;
  }
}

// 3. Load Admins Management Page
async function loadAdminsManagement() {
  const tableBody = document.getElementById("admins-table-body");
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;"><div class="spinner"></div></td></tr>`;

  try {
    const { data: admins, error } = await window.supabaseClient
      .from("profiles")
      .select("id, full_name, username, email, status, created_at")
      .eq("role", "admin")
      .order("created_at", { ascending: true });

    if (error) throw error;

    adminsListCache = admins || [];
    renderAdminsTable();

    setupCreateAdminForm();

    const countDisplay = document.getElementById("admins-count-display");
    if (countDisplay) {
      const activeCount = adminsListCache.filter(a => a.status === "active").length;
      countDisplay.textContent = `${activeCount} / 9 Active Normal Admins`;
    }
  } catch (err) {
    console.error("Error loading admins:", err);
    tableBody.innerHTML = `<tr><td colspan="6" style="color:var(--danger);text-align:center;padding:1rem;">Failed to load administrators.</td></tr>`;
  }
}

// 4. Render Admins Table
function renderAdminsTable() {
  const tableBody = document.getElementById("admins-table-body");
  if (!tableBody) return;

  if (adminsListCache.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;padding:2rem;color:var(--text-light);">
          No normal administrators created yet. You can create up to 9 normal admins.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = adminsListCache.map(a => `
    <tr>
      <td><strong>${window.CLASS_HUB_UTILS.escapeHtml(a.full_name)}</strong></td>
      <td><code>${window.CLASS_HUB_UTILS.escapeHtml(a.username)}</code></td>
      <td>${window.CLASS_HUB_UTILS.escapeHtml(a.email)}</td>
      <td>
        <span class="status-pill ${a.status === 'active' ? 'active' : 'inactive'}">
          ${a.status}
        </span>
      </td>
      <td>${window.CLASS_HUB_UTILS.formatDate(a.created_at)}</td>
      <td>
        <div class="table-actions">
          <button type="button" class="action-btn" onclick="toggleAdminStatus('${a.id}', '${a.status}')">
            ${a.status === 'active' ? '⏸️ Deactivate' : '▶️ Activate'}
          </button>
          <button type="button" class="action-btn" onclick="openResetPasswordModal('${a.id}', '${window.CLASS_HUB_UTILS.escapeHtml(a.full_name)}')">
            🔑 Reset PW
          </button>
        </div>
      </td>
    </tr>
  `).join("");
}

// 5. Setup Create Admin Form
function setupCreateAdminForm() {
  const form = document.getElementById("form-create-admin");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector("button[type='submit']");

    const fullName = document.getElementById("new-admin-name").value.trim();
    const username = document.getElementById("new-admin-username").value.trim().toLowerCase();
    const email = document.getElementById("new-admin-email").value.trim().toLowerCase();
    const password = document.getElementById("new-admin-password").value;

    if (!fullName || !username || !email || !password) {
      window.CLASS_HUB_UTILS.showToast("All fields are required.", "warning");
      return;
    }

    if (password.length < 6) {
      window.CLASS_HUB_UTILS.showToast("Password must be at least 6 characters.", "warning");
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner spinner-sm spinner-light"></span> Creating Admin...`;

      // Call secure database function
      const { data, error } = await window.supabaseClient.rpc("admin_create_account", {
        p_email: email,
        p_password: password,
        p_full_name: fullName,
        p_username: username,
        p_role: "admin"
      });

      if (error) throw error;

      window.CLASS_HUB_UTILS.showToast(`Administrator @${username} created!`, "success");
      form.reset();
      window.CLASS_HUB_UTILS.closeModal("modal-create-admin");
      await loadAdminsManagement();
    } catch (err) {
      console.error("Create admin error:", err);
      window.CLASS_HUB_UTILS.showToast(err.message || "Failed to create administrator account.", "danger");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Create Administrator`;
    }
  });
}

// 6. Toggle Admin Status
window.toggleAdminStatus = async function(userId, currentStatus) {
  const newStatus = currentStatus === "active" ? "inactive" : "active";
  const actionText = newStatus === "active" ? "activate" : "deactivate";

  if (!confirm(`Are you sure you want to ${actionText} this administrator account?`)) return;

  try {
    const { error } = await window.supabaseClient.rpc("admin_toggle_user_status", {
      p_user_id: userId,
      p_new_status: newStatus
    });

    if (error) throw error;

    window.CLASS_HUB_UTILS.showToast(`Admin account has been ${newStatus}d.`, "success");
    await loadAdminsManagement();
  } catch (err) {
    console.error("Toggle admin status error:", err);
    window.CLASS_HUB_UTILS.showToast(err.message || "Failed to update account status.", "danger");
  }
};

// 7. Load Portal Settings (head-admin/settings.html)
async function loadPortalSettings() {
  const generalForm = document.getElementById("form-portal-settings");
  const subjectsContainer = document.getElementById("settings-subjects-container");

  try {
    // 1. Load General Settings
    const { data: settings, error: settErr } = await window.supabaseClient
      .from("portal_settings")
      .select("*")
      .eq("id", "primary")
      .single();

    if (!settErr && settings && generalForm) {
      generalForm.class_title.value = settings.class_title || "Batch 35 — BSSE (Afternoon)";
      generalForm.portal_name.value = settings.portal_name || "CLASS HUB";
      generalForm.timezone.value = settings.timezone || "Asia/Karachi";
    }

    // 2. Load Subjects and their Theory/Lab toggles
    const { data: subjects, error: subjErr } = await window.supabaseClient
      .from("subjects")
      .select("id, name, code, description, is_active, subject_sections(id, section_type, is_active)")
      .order("code", { ascending: true });

    if (!subjErr && subjects && subjectsContainer) {
      subjectsContainer.innerHTML = subjects.map(s => {
        const theorySec = (s.subject_sections || []).find(sec => sec.section_type === "theory");
        const labSec = (s.subject_sections || []).find(sec => sec.section_type === "lab");

        return `
          <div class="card" style="margin-bottom:1.5rem;">
            <div class="card-header">
              <h3 class="card-title">📖 ${window.CLASS_HUB_UTILS.escapeHtml(s.code)}</h3>
              <span class="badge ${s.is_active ? 'badge-success' : 'badge-normal'}">${s.is_active ? 'Active' : 'Inactive'}</span>
            </div>
            <form onsubmit="saveSubjectSettings(event, '${s.id}', '${theorySec?.id || ''}', '${labSec?.id || ''}')">
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:1rem;margin-bottom:1rem;">
                <div class="form-group">
                  <label class="form-label">Subject Full Name</label>
                  <input type="text" class="form-control" name="subject_name" value="${window.CLASS_HUB_UTILS.escapeHtml(s.name)}" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Subject Code</label>
                  <input type="text" class="form-control" name="subject_code" value="${window.CLASS_HUB_UTILS.escapeHtml(s.code)}" required>
                </div>
              </div>
              <div class="form-group" style="margin-bottom:1rem;">
                <label class="form-label">Subject Description</label>
                <textarea class="form-control" name="subject_desc" rows="2">${window.CLASS_HUB_UTILS.escapeHtml(s.description || "")}</textarea>
              </div>
              <div style="display:flex;gap:1.5rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap;">
                <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.9rem;">
                  <input type="checkbox" name="has_theory" ${theorySec && theorySec.is_active ? 'checked' : ''}>
                  <strong>Enable Theory Section</strong>
                </label>
                <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.9rem;">
                  <input type="checkbox" name="has_lab" ${labSec && labSec.is_active ? 'checked' : ''}>
                  <strong>Enable Lab Section</strong>
                </label>
              </div>
              <div style="display:flex;justify-content:flex-end;">
                <button type="submit" class="btn btn-sm btn-primary">Update Subject Configuration</button>
              </div>
            </form>
          </div>
        `;
      }).join("");
    }
  } catch (err) {
    console.error("Portal settings error:", err);
  }

  // Setup general settings save
  if (generalForm) {
    generalForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = generalForm.querySelector("button[type='submit']");
      const classTitle = generalForm.class_title.value.trim();
      const portalName = generalForm.portal_name.value.trim();
      const timezone = generalForm.timezone.value.trim();

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner spinner-sm spinner-light"></span> Saving...`;

        const { error } = await window.supabaseClient
          .from("portal_settings")
          .update({
            class_title: classTitle,
            portal_name: portalName,
            timezone: timezone,
            updated_at: new Date().toISOString()
          })
          .eq("id", "primary");

        if (error) throw error;
        window.CLASS_HUB_UTILS.showToast("Portal settings saved!", "success");
      } catch (err) {
        console.error("Save settings error:", err);
        window.CLASS_HUB_UTILS.showToast("Failed to save portal settings.", "danger");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Save General Settings`;
      }
    });
  }
}

// 8. Save Subject Configuration
window.saveSubjectSettings = async function(e, subjectId, theorySecId, labSecId) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector("button[type='submit']");

  const name = form.subject_name.value.trim();
  const code = form.subject_code.value.trim();
  const description = form.subject_desc.value.trim();
  const hasTheory = form.has_theory.checked;
  const hasLab = form.has_lab.checked;

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner spinner-sm spinner-light"></span> Updating...`;

    // 1. Update subject name and description
    const { error: subjErr } = await window.supabaseClient
      .from("subjects")
      .update({
        name,
        code,
        description,
        updated_at: new Date().toISOString()
      })
      .eq("id", subjectId);

    if (subjErr) throw subjErr;

    // 2. Update sections
    if (theorySecId) {
      await window.supabaseClient
        .from("subject_sections")
        .update({ is_active: hasTheory })
        .eq("id", theorySecId);
    }
    if (labSecId) {
      await window.supabaseClient
        .from("subject_sections")
        .update({ is_active: hasLab })
        .eq("id", labSecId);
    }

    window.CLASS_HUB_UTILS.showToast(`Updated ${code} configuration!`, "success");
  } catch (err) {
    console.error("Save subject configuration error:", err);
    window.CLASS_HUB_UTILS.showToast("Failed to update subject.", "danger");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `Update Subject Configuration`;
  }
};
