/**
 * ==============================================================================
 * BATCH 35 — BSSE (Afternoon) — CLASS HUB
 * Student Query & Support System Module
 * ==============================================================================
 */

let allQueriesCache = [];
let currentViewingQuery = null;

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await window.CLASS_HUB_AUTH.requireAuth(["student", "admin", "head_admin"]);
  if (!profile) return;

  await loadSubjectsFilter();
  await loadQueries();

  setupFilterHandlers();
  setupQueryForm();
  setupReplyForm();
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
    const formSelect = document.getElementById("query-subject");

    const options = (subjects || []).map(s => 
      `<option value="${s.id}">${window.CLASS_HUB_UTILS.escapeHtml(s.code)} — ${window.CLASS_HUB_UTILS.escapeHtml(s.name)}</option>`
    ).join("");

    if (filterSelect) {
      filterSelect.innerHTML = `<option value="">All Subjects</option>` + options;
    }
    if (formSelect) {
      formSelect.innerHTML = `<option value="">General Academic Query</option>` + options;
    }
  } catch (err) {
    console.error("Error loading subjects for queries:", err);
  }
}

// 2. Load queries from database
async function loadQueries() {
  const container = document.getElementById("queries-list");
  if (!container) return;

  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><span>Loading queries...</span></div>`;

  try {
    const profile = await window.CLASS_HUB_AUTH.getCurrentProfile();
    const isAdmin = profile.role === "admin" || profile.role === "head_admin";

    // Query with subjects and profiles
    let queryBuilder = window.supabaseClient
      .from("queries")
      .select(`
        id,
        title,
        message,
        status,
        created_at,
        student_id,
        subject_id,
        subjects(name, code),
        profiles!queries_student_id_fkey(full_name, username),
        query_replies(id, message, created_at, admin_id, profiles(full_name))
      `)
      .order("created_at", { ascending: false });

    // Students only fetch their own queries (RLS also strictly enforces this)
    if (!isAdmin) {
      queryBuilder = queryBuilder.eq("student_id", profile.id);
    }

    const { data: queries, error } = await queryBuilder;
    if (error) throw error;

    allQueriesCache = queries || [];
    renderFilteredQueries();
  } catch (err) {
    console.error("Error loading queries:", err);
    container.innerHTML = `<p class="form-helper">Failed to load queries.</p>`;
  }
}

// 3. Render filtered queries
function renderFilteredQueries() {
  const container = document.getElementById("queries-list");
  if (!container) return;

  const subjectFilter = document.getElementById("filter-subject")?.value || "";
  const statusFilter = document.getElementById("filter-status")?.value || "";

  const filtered = allQueriesCache.filter(q => {
    if (subjectFilter && q.subject_id !== subjectFilter) return false;
    if (statusFilter && q.status !== statusFilter) return false;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💬</div>
        <h3>No queries found</h3>
        <p>No student support inquiries found matching the filter.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(q => {
    const statusClass = q.status.toLowerCase().replace(" ", "-");
    const subjectCode = q.subjects?.code || "General";
    const studentName = q.profiles?.full_name || "Student";
    const repliesCount = q.query_replies ? q.query_replies.length : 0;

    return `
      <div class="query-card">
        <div class="query-header">
          <div>
            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.35rem;">
              <span class="badge badge-primary">${window.CLASS_HUB_UTILS.escapeHtml(subjectCode)}</span>
              <span class="query-status-badge ${statusClass}">${window.CLASS_HUB_UTILS.escapeHtml(q.status)}</span>
              <span style="font-size:0.8rem;color:var(--text-light);">Asked by ${window.CLASS_HUB_UTILS.escapeHtml(studentName)}</span>
            </div>
            <h3 style="font-size:1.1rem;">${window.CLASS_HUB_UTILS.escapeHtml(q.title)}</h3>
          </div>
          <time style="font-size:0.8rem;color:var(--text-light);">${window.CLASS_HUB_UTILS.formatDate(q.created_at)}</time>
        </div>
        <p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:1rem;line-height:1.5;">${window.CLASS_HUB_UTILS.escapeHtml(q.message)}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:0.75rem;border-top:1px solid var(--border);">
          <span style="font-size:0.85rem;color:var(--text-light);font-weight:600;">
            💬 ${repliesCount} ${repliesCount === 1 ? 'Reply' : 'Replies'}
          </span>
          <button type="button" class="btn btn-sm btn-outline" onclick="openQueryThreadModal('${q.id}')">
            View Conversation &rarr;
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// 4. Setup filter listeners
function setupFilterHandlers() {
  document.getElementById("filter-subject")?.addEventListener("change", renderFilteredQueries);
  document.getElementById("filter-status")?.addEventListener("change", renderFilteredQueries);
}

// 5. Submit Query Form (Student)
function setupQueryForm() {
  const form = document.getElementById("form-submit-query");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector("button[type='submit']");
    const title = document.getElementById("query-title").value.trim();
    const subjectId = document.getElementById("query-subject").value || null;
    const message = document.getElementById("query-message").value.trim();

    if (!title || !message) {
      window.CLASS_HUB_UTILS.showToast("Please provide a title and your question.", "warning");
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner spinner-sm spinner-light"></span> Submitting...`;

      const user = await window.CLASS_HUB_AUTH.getCurrentUser();

      const { error } = await window.supabaseClient
        .from("queries")
        .insert({
          title,
          message,
          subject_id: subjectId,
          student_id: user.id,
          status: "Open"
        });

      if (error) throw error;

      window.CLASS_HUB_UTILS.showToast("Your question has been sent to the class admins!", "success");
      form.reset();
      window.CLASS_HUB_UTILS.closeModal("modal-submit-query");
      await loadQueries();
    } catch (err) {
      console.error("Query submission error:", err);
      window.CLASS_HUB_UTILS.showToast("Failed to submit query.", "danger");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Submit Question`;
    }
  });
}

// 6. View Query Thread Modal
window.openQueryThreadModal = function(queryId) {
  const q = allQueriesCache.find(item => item.id === queryId);
  if (!q) return;

  currentViewingQuery = q;

  document.getElementById("thread-query-title").textContent = q.title;
  document.getElementById("thread-query-subject").textContent = q.subjects?.code || "General Query";
  document.getElementById("thread-query-student").textContent = q.profiles?.full_name || "Student";
  document.getElementById("thread-query-date").textContent = window.CLASS_HUB_UTILS.formatDateTime(q.created_at);
  document.getElementById("thread-query-body").textContent = q.message;

  const statusBadge = document.getElementById("thread-query-status");
  statusBadge.className = `query-status-badge ${q.status.toLowerCase().replace(" ", "-")}`;
  statusBadge.textContent = q.status;

  // Set status selector for admins
  const statusSelector = document.getElementById("admin-update-query-status");
  if (statusSelector) {
    statusSelector.value = q.status;
  }

  // Render Replies List
  const repliesContainer = document.getElementById("thread-replies-list");
  const replies = q.query_replies || [];

  if (replies.length === 0) {
    repliesContainer.innerHTML = `
      <div style="padding:1.5rem;text-align:center;color:var(--text-light);font-size:0.875rem;background:var(--surface-alt);border-radius:var(--radius-md);">
        No replies from administrators yet.
      </div>
    `;
  } else {
    repliesContainer.innerHTML = replies.map(r => `
      <div style="background:var(--surface-alt);border-radius:var(--radius-md);padding:1rem;margin-bottom:0.75rem;border-left:3px solid var(--primary);">
        <div style="display:flex;justify-content:space-between;margin-bottom:0.35rem;">
          <strong style="font-size:0.85rem;color:var(--primary);">👨‍🏫 ${window.CLASS_HUB_UTILS.escapeHtml(r.profiles?.full_name || "Administrator")}</strong>
          <span style="font-size:0.75rem;color:var(--text-light);">${window.CLASS_HUB_UTILS.formatDateTime(r.created_at)}</span>
        </div>
        <p style="font-size:0.9rem;color:var(--text-main);line-height:1.45;">${window.CLASS_HUB_UTILS.escapeHtml(r.message)}</p>
      </div>
    `).join("");
  }

  window.CLASS_HUB_UTILS.openModal("modal-query-thread");
};

// 7. Setup Reply Form (Admin)
function setupReplyForm() {
  const form = document.getElementById("form-reply-query");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentViewingQuery) return;

    const replyMsg = document.getElementById("admin-reply-message").value.trim();
    const newStatus = document.getElementById("admin-update-query-status")?.value || currentViewingQuery.status;

    if (!replyMsg && newStatus === currentViewingQuery.status) {
      window.CLASS_HUB_UTILS.showToast("Please write a reply or change the query status.", "warning");
      return;
    }

    const submitBtn = form.querySelector("button[type='submit']");

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner spinner-sm spinner-light"></span> Sending...`;

      const user = await window.CLASS_HUB_AUTH.getCurrentUser();

      // If reply message is provided, insert into query_replies
      if (replyMsg) {
        const { error: replyError } = await window.supabaseClient
          .from("query_replies")
          .insert({
            query_id: currentViewingQuery.id,
            admin_id: user.id,
            message: replyMsg
          });

        if (replyError) throw replyError;
      }

      // Update status if changed
      if (newStatus !== currentViewingQuery.status) {
        const { error: statusError } = await window.supabaseClient
          .from("queries")
          .update({
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq("id", currentViewingQuery.id);

        if (statusError) throw statusError;
      }

      window.CLASS_HUB_UTILS.showToast("Response submitted!", "success");
      form.reset();
      window.CLASS_HUB_UTILS.closeModal("modal-query-thread");
      await loadQueries();
    } catch (err) {
      console.error("Reply error:", err);
      window.CLASS_HUB_UTILS.showToast("Failed to send reply.", "danger");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Send Response`;
    }
  });
}
