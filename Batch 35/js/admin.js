/**
 * ==============================================================================
 * BATCH 35 — BSSE (Afternoon) — CLASS HUB
 * Admin Operations & Student Management Module
 * ==============================================================================
 */

let studentsListCache = [];

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await window.CLASS_HUB_AUTH.requireAuth(["admin", "head_admin"]);
  if (!profile) return;

  // Determine current admin view
  if (window.location.pathname.includes("dashboard.html")) {
    loadAdminDashboardStats();
  } else if (window.location.pathname.includes("students.html")) {
    loadStudentsManagement();
  } else if (window.location.pathname.includes("links.html")) {
    loadCourseLinksManagement();
  }
});

// 1. Load Admin Dashboard Statistics
async function loadAdminDashboardStats() {
  try {
    const { data: stats, error } = await window.supabaseClient.rpc("get_portal_stats");

    if (error) {
      console.warn("RPC get_portal_stats error, falling back to direct counts:", error);
      loadStatsDirectly();
      return;
    }

    renderStatValue("stat-students", `${stats.active_students} / 40`);
    renderStatValue("stat-subjects", stats.total_subjects);
    renderStatValue("stat-announcements", stats.total_announcements);
    renderStatValue("stat-tasks", stats.active_tasks);
    renderStatValue("stat-documents", stats.total_documents);
    renderStatValue("stat-queries", stats.open_queries);

    // Update capacity progress bar if present
    const capacityCountEl = document.getElementById("capacity-total-count");
    if (capacityCountEl) {
      capacityCountEl.textContent = `${stats.total_active_accounts} / 50 Accounts Active`;
    }

    const studentBar = document.getElementById("bar-students");
    const adminBar = document.getElementById("bar-admins");
    const headAdminBar = document.getElementById("bar-head-admin");

    if (studentBar) studentBar.style.width = `${(stats.active_students / 50) * 100}%`;
    if (adminBar) adminBar.style.width = `${(stats.active_admins / 50) * 100}%`;
    if (headAdminBar) headAdminBar.style.width = `${(stats.active_head_admins / 50) * 100}%`;

  } catch (err) {
    console.error("Dashboard stats error:", err);
    loadStatsDirectly();
  }
}

function renderStatValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val !== undefined ? val : 0;
}

// Fallback direct count query
async function loadStatsDirectly() {
  try {
    const [
      { count: studentsCount },
      { count: subjectsCount },
      { count: announcementsCount },
      { count: tasksCount },
      { count: docsCount },
      { count: queriesCount }
    ] = await Promise.all([
      window.supabaseClient.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student").eq("status", "active"),
      window.supabaseClient.from("subjects").select("*", { count: "exact", head: true }).eq("is_active", true),
      window.supabaseClient.from("announcements").select("*", { count: "exact", head: true }),
      window.supabaseClient.from("weekly_tasks").select("*", { count: "exact", head: true }).eq("status", "Active"),
      window.supabaseClient.from("documents").select("*", { count: "exact", head: true }),
      window.supabaseClient.from("queries").select("*", { count: "exact", head: true }).eq("status", "Open")
    ]);

    renderStatValue("stat-students", `${studentsCount || 0} / 40`);
    renderStatValue("stat-subjects", subjectsCount || 0);
    renderStatValue("stat-announcements", announcementsCount || 0);
    renderStatValue("stat-tasks", tasksCount || 0);
    renderStatValue("stat-documents", docsCount || 0);
    renderStatValue("stat-queries", queriesCount || 0);
  } catch (err) {
    console.error("Direct stats error:", err);
  }
}

// 2. Load Students Management Page
async function loadStudentsManagement() {
  const tableBody = document.getElementById("students-table-body");
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;"><div class="spinner"></div></td></tr>`;

  try {
    const { data: students, error } = await window.supabaseClient
      .from("profiles")
      .select("id, full_name, username, email, status, created_at")
      .eq("role", "student")
      .order("created_at", { ascending: false });

    if (error) throw error;

    studentsListCache = students || [];
    renderStudentsTable();

    // Setup student creation form
    setupCreateStudentForm();

    // Setup student search
    document.getElementById("search-students")?.addEventListener("input", renderStudentsTable);

    // Update count display
    const countDisplay = document.getElementById("students-count-display");
    if (countDisplay) {
      const activeCount = studentsListCache.filter(s => s.status === "active").length;
      countDisplay.textContent = `${activeCount} / 40 Active Students`;
    }
  } catch (err) {
    console.error("Error loading students:", err);
    tableBody.innerHTML = `<tr><td colspan="6" style="color:var(--danger);text-align:center;padding:1rem;">Failed to load students.</td></tr>`;
  }
}

// 3. Render Students Table
function renderStudentsTable() {
  const tableBody = document.getElementById("students-table-body");
  if (!tableBody) return;

  const searchQuery = (document.getElementById("search-students")?.value || "").toLowerCase().trim();

  const filtered = studentsListCache.filter(s => {
    if (searchQuery) {
      const nameMatch = s.full_name.toLowerCase().includes(searchQuery);
      const userMatch = s.username.toLowerCase().includes(searchQuery);
      const emailMatch = s.email.toLowerCase().includes(searchQuery);
      if (!nameMatch && !userMatch && !emailMatch) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;padding:2rem;color:var(--text-light);">
          No students found matching your search.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(s => `
    <tr>
      <td><strong>${window.CLASS_HUB_UTILS.escapeHtml(s.full_name)}</strong></td>
      <td><code>${window.CLASS_HUB_UTILS.escapeHtml(s.username)}</code></td>
      <td>${window.CLASS_HUB_UTILS.escapeHtml(s.email)}</td>
      <td>
        <span class="status-pill ${s.status === 'active' ? 'active' : 'inactive'}">
          ${s.status}
        </span>
      </td>
      <td>${window.CLASS_HUB_UTILS.formatDate(s.created_at)}</td>
      <td>
        <div class="table-actions">
          <button type="button" class="action-btn" onclick="toggleStudentStatus('${s.id}', '${s.status}')">
            ${s.status === 'active' ? '⏸️ Deactivate' : '▶️ Activate'}
          </button>
          <button type="button" class="action-btn" onclick="openResetPasswordModal('${s.id}', '${window.CLASS_HUB_UTILS.escapeHtml(s.full_name)}')">
            🔑 Reset PW
          </button>
        </div>
      </td>
    </tr>
  `).join("");
}

// 4. Create Student Form
function setupCreateStudentForm() {
  const form = document.getElementById("form-create-student");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector("button[type='submit']");

    const fullName = document.getElementById("new-student-name").value.trim();
    const username = document.getElementById("new-student-username").value.trim().toLowerCase();
    const email = document.getElementById("new-student-email").value.trim().toLowerCase();
    const password = document.getElementById("new-student-password").value;

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
      submitBtn.innerHTML = `<span class="spinner spinner-sm spinner-light"></span> Creating Account...`;

      // Call secure database function
      const { data, error } = await window.supabaseClient.rpc("admin_create_account", {
        p_email: email,
        p_password: password,
        p_full_name: fullName,
        p_username: username,
        p_role: "student"
      });

      if (error) throw error;

      window.CLASS_HUB_UTILS.showToast(`Student account @${username} created successfully!`, "success");
      form.reset();
      window.CLASS_HUB_UTILS.closeModal("modal-create-student");
      await loadStudentsManagement();
    } catch (err) {
      console.error("Create student error:", err);
      window.CLASS_HUB_UTILS.showToast(err.message || "Failed to create student account.", "danger");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Create Student Account`;
    }
  });
}

// 5. Toggle Student Status (Activate / Deactivate)
window.toggleStudentStatus = async function(userId, currentStatus) {
  const newStatus = currentStatus === "active" ? "inactive" : "active";
  const actionText = newStatus === "active" ? "activate" : "deactivate";

  if (!confirm(`Are you sure you want to ${actionText} this student account?`)) return;

  try {
    const { error } = await window.supabaseClient.rpc("admin_toggle_user_status", {
      p_user_id: userId,
      p_new_status: newStatus
    });

    if (error) throw error;

    window.CLASS_HUB_UTILS.showToast(`Student account has been ${newStatus}d.`, "success");
    await loadStudentsManagement();
  } catch (err) {
    console.error("Toggle status error:", err);
    window.CLASS_HUB_UTILS.showToast(err.message || "Failed to update account status.", "danger");
  }
};

// 6. Reset Student Password Modal
window.openResetPasswordModal = function(userId, studentName) {
  document.getElementById("reset-password-user-id").value = userId;
  document.getElementById("reset-password-user-name").textContent = studentName;
  document.getElementById("new-reset-password").value = "";
  window.CLASS_HUB_UTILS.openModal("modal-reset-password");
};

// Handle Reset Password Submission
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-reset-password");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const userId = document.getElementById("reset-password-user-id").value;
      const newPassword = document.getElementById("new-reset-password").value;

      if (!newPassword || newPassword.length < 6) {
        window.CLASS_HUB_UTILS.showToast("Password must be at least 6 characters.", "warning");
        return;
      }

      const submitBtn = form.querySelector("button[type='submit']");
      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner spinner-sm spinner-light"></span> Updating Password...`;

        const { error } = await window.supabaseClient.rpc("admin_reset_password", {
          p_user_id: userId,
          p_new_password: newPassword
        });

        if (error) throw error;

        window.CLASS_HUB_UTILS.showToast("Password has been reset successfully!", "success");
        form.reset();
        window.CLASS_HUB_UTILS.closeModal("modal-reset-password");
      } catch (err) {
        console.error("Reset password error:", err);
        window.CLASS_HUB_UTILS.showToast(err.message || "Failed to reset password.", "danger");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Update Password`;
      }
    });
  }
});

// 7. Course Links Management (admin/links.html)
async function loadCourseLinksManagement() {
  const container = document.getElementById("course-links-form-container");
  if (!container) return;

  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><span>Loading course links...</span></div>`;

  try {
    const { data: subjects, error: subjErr } = await window.supabaseClient
      .from("subjects")
      .select("id, name, code, subject_sections(section_type, is_active)")
      .eq("is_active", true)
      .order("code", { ascending: true });

    if (subjErr) throw subjErr;

    const { data: links, error: linkErr } = await window.supabaseClient
      .from("course_links")
      .select("*");

    if (linkErr) throw linkErr;

    container.innerHTML = subjects.map(sub => {
      const activeSections = (sub.subject_sections || []).filter(s => s.is_active);

      return `
        <div class="card" style="margin-bottom:1.5rem;">
          <div class="card-header">
            <h3 class="card-title">📚 ${window.CLASS_HUB_UTILS.escapeHtml(sub.code)} — ${window.CLASS_HUB_UTILS.escapeHtml(sub.name)}</h3>
          </div>
          <div style="display:flex;flex-direction:column;gap:1.5rem;">
            ${activeSections.map(sec => {
              const currentLink = (links || []).find(l => l.subject_id === sub.id && l.section_type === sec.section_type);
              const classroomVal = currentLink?.google_classroom_url || "";
              const lmsVal = currentLink?.lms_url || "";
              const additionalVal = currentLink?.additional_resource_url || "";

              return `
                <div style="background:var(--surface-alt);padding:1.25rem;border-radius:var(--radius-md);border:1px solid var(--border);">
                  <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;">
                    <span class="section-pill" style="font-size:0.85rem;padding:0.25rem 0.6rem;">${sec.section_type.toUpperCase()} SECTION</span>
                  </div>
                  <form onsubmit="saveCourseLink(event, '${sub.id}', '${sec.section_type}')">
                    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:1rem;">
                      <div class="form-group">
                        <label class="form-label">Google Classroom URL</label>
                        <input type="url" class="form-control" name="classroom_url" value="${window.CLASS_HUB_UTILS.escapeHtml(classroomVal)}" placeholder="https://classroom.google.com/c/...">
                      </div>
                      <div class="form-group">
                        <label class="form-label">University LMS URL</label>
                        <input type="url" class="form-control" name="lms_url" value="${window.CLASS_HUB_UTILS.escapeHtml(lmsVal)}" placeholder="https://lms.university.edu/...">
                      </div>
                      <div class="form-group" style="grid-column: 1 / -1;">
                        <label class="form-label">Additional Resource Link (Optional)</label>
                        <input type="url" class="form-control" name="additional_url" value="${window.CLASS_HUB_UTILS.escapeHtml(additionalVal)}" placeholder="https://drive.google.com/... or GitHub">
                      </div>
                    </div>
                    <div style="display:flex;justify-content:flex-end;margin-top:0.5rem;">
                      <button type="submit" class="btn btn-sm btn-primary">Save Links</button>
                    </div>
                  </form>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Course links management error:", err);
    container.innerHTML = `<p class="form-helper">Failed to load course links.</p>`;
  }
}

// Save single course link row
window.saveCourseLink = async function(e, subjectId, sectionType) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector("button[type='submit']");

  const classroomUrl = form.classroom_url.value.trim();
  const lmsUrl = form.lms_url.value.trim();
  const additionalUrl = form.additional_url.value.trim();

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner spinner-sm spinner-light"></span> Saving...`;

    const user = await window.CLASS_HUB_AUTH.getCurrentUser();

    const { error } = await window.supabaseClient
      .from("course_links")
      .upsert({
        subject_id: subjectId,
        section_type: sectionType,
        google_classroom_url: classroomUrl,
        lms_url: lmsUrl,
        additional_resource_url: additionalUrl,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      }, { onConflict: "subject_id, section_type" });

    if (error) throw error;

    window.CLASS_HUB_UTILS.showToast(`Links updated for ${sectionType.toUpperCase()}!`, "success");
  } catch (err) {
    console.error("Save course link error:", err);
    window.CLASS_HUB_UTILS.showToast("Failed to save links.", "danger");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `Save Links`;
  }
};
