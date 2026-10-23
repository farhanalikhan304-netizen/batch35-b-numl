/**
 * ==============================================================================
 * BATCH 35 — BSSE (Afternoon) — CLASS HUB
 * Document Management & Storage Module
 * ==============================================================================
 */

let allDocumentsCache = [];
let availableSubjectsCache = [];

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await window.CLASS_HUB_AUTH.requireAuth(["student", "admin", "head_admin"]);
  if (!profile) return;

  // Populate subject filter & upload selectors
  await loadSubjectsFilter();

  // Load documents
  await loadDocuments();

  // Setup search & filter handlers
  setupFilterHandlers();

  // Setup admin upload form if present
  setupUploadForm();
});

// 1. Load subjects into filter dropdowns
async function loadSubjectsFilter() {
  try {
    const { data: subjects, error } = await window.supabaseClient
      .from("subjects")
      .select("id, name, code")
      .eq("is_active", true)
      .order("code", { ascending: true });

    if (error) throw error;
    availableSubjectsCache = subjects || [];

    const filterSelect = document.getElementById("filter-subject");
    const uploadSelect = document.getElementById("upload-subject");

    const optionsHtml = subjects.map(s => 
      `<option value="${s.id}">${window.CLASS_HUB_UTILS.escapeHtml(s.code)} — ${window.CLASS_HUB_UTILS.escapeHtml(s.name)}</option>`
    ).join("");

    if (filterSelect) {
      filterSelect.innerHTML = `<option value="">All Subjects</option>` + optionsHtml;
    }
    if (uploadSelect) {
      uploadSelect.innerHTML = `<option value="" disabled selected>Select Subject</option>` + optionsHtml;
    }
  } catch (err) {
    console.error("Error loading subject filters:", err);
  }
}

// 2. Load documents from database
async function loadDocuments() {
  const container = document.getElementById("documents-list");
  if (!container) return;

  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><span>Loading documents...</span></div>`;

  try {
    const { data: docs, error } = await window.supabaseClient
      .from("documents")
      .select(`
        id,
        title,
        description,
        category,
        section_type,
        storage_path,
        original_file_name,
        file_size,
        mime_type,
        created_at,
        uploaded_by,
        subjects(name, code)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    allDocumentsCache = docs || [];
    renderFilteredDocuments();
  } catch (err) {
    console.error("Error loading documents:", err);
    container.innerHTML = `<p class="form-helper">Failed to load documents.</p>`;
  }
}

// 3. Render filtered documents
function renderFilteredDocuments() {
  const container = document.getElementById("documents-list");
  if (!container) return;

  const subjectFilter = document.getElementById("filter-subject")?.value || "";
  const sectionFilter = document.getElementById("filter-section")?.value || "";
  const categoryFilter = document.getElementById("filter-category")?.value || "";
  const searchQuery = (document.getElementById("search-documents")?.value || "").toLowerCase().trim();

  const filtered = allDocumentsCache.filter(doc => {
    if (subjectFilter && doc.subjects?.id !== subjectFilter && doc.subject_id !== subjectFilter) {
      // Check both nested subject id and direct
      const subjectMatch = doc.subjects?.id === subjectFilter || allDocumentsCache.some(d => d.id === doc.id && d.subject_id === subjectFilter);
      if (!subjectMatch) return false;
    }
    if (sectionFilter && doc.section_type !== sectionFilter) return false;
    if (categoryFilter && doc.category !== categoryFilter) return false;
    if (searchQuery) {
      const titleMatch = doc.title.toLowerCase().includes(searchQuery);
      const descMatch = (doc.description || "").toLowerCase().includes(searchQuery);
      const fileMatch = doc.original_file_name.toLowerCase().includes(searchQuery);
      if (!titleMatch && !descMatch && !fileMatch) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📄</div>
        <h3>No documents found</h3>
        <p>No academic documents match your current filter criteria.</p>
      </div>
    `;
    return;
  }

  const isAdminView = window.location.pathname.includes("/admin/") || window.location.pathname.includes("/head-admin/");

  container.innerHTML = filtered.map(doc => {
    const ext = doc.original_file_name.split(".").pop().toUpperCase();
    const fileSize = window.CLASS_HUB_UTILS.formatFileSize(doc.file_size);
    const subjectCode = doc.subjects?.code || "Subject";

    return `
      <div class="document-item">
        <div class="doc-info">
          <div class="doc-icon">${ext || "DOC"}</div>
          <div class="doc-text">
            <h4>${window.CLASS_HUB_UTILS.escapeHtml(doc.title)}</h4>
            <div class="doc-meta">
              <span class="badge badge-primary">${window.CLASS_HUB_UTILS.escapeHtml(subjectCode)}</span>
              <span class="section-pill">${doc.section_type.toUpperCase()}</span>
              <span class="badge badge-normal">${window.CLASS_HUB_UTILS.escapeHtml(doc.category)}</span>
              <span>Size: ${fileSize}</span>
              <span>Date: ${window.CLASS_HUB_UTILS.formatDate(doc.created_at)}</span>
            </div>
            ${doc.description ? `<p style="font-size:0.85rem;color:var(--text-muted);margin-top:0.35rem;">${window.CLASS_HUB_UTILS.escapeHtml(doc.description)}</p>` : ""}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
          <button type="button" class="btn btn-sm btn-primary" onclick="downloadDocumentFile('${doc.storage_path}', '${encodeURIComponent(doc.original_file_name)}')">
            Download &darr;
          </button>
          ${isAdminView ? `
            <button type="button" class="action-btn danger" onclick="deleteDocument('${doc.id}', '${doc.storage_path}')" title="Delete document">
              🗑️ Delete
            </button>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");
}

// 4. Setup filter handlers
function setupFilterHandlers() {
  document.getElementById("filter-subject")?.addEventListener("change", renderFilteredDocuments);
  document.getElementById("filter-section")?.addEventListener("change", renderFilteredDocuments);
  document.getElementById("filter-category")?.addEventListener("change", renderFilteredDocuments);
  document.getElementById("search-documents")?.addEventListener("input", renderFilteredDocuments);
}

// 5. Setup Admin Upload Form
function setupUploadForm() {
  const form = document.getElementById("form-upload-document");
  const fileInput = document.getElementById("upload-file-input");
  const dropZone = document.getElementById("file-drop-zone");
  const preview = document.getElementById("selected-file-preview");

  if (!form || !fileInput) return;

  // File drag & drop handling
  if (dropZone) {
    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        updateFilePreview(fileInput.files[0]);
      }
    });
  }

  fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
      updateFilePreview(fileInput.files[0]);
    }
  });

  function updateFilePreview(file) {
    if (preview && file) {
      preview.style.display = "flex";
      preview.innerHTML = `
        <span>📁 <strong>${window.CLASS_HUB_UTILS.escapeHtml(file.name)}</strong> (${window.CLASS_HUB_UTILS.formatFileSize(file.size)})</span>
        <button type="button" class="action-btn danger" style="padding:0.2rem 0.4rem;" onclick="clearSelectedUploadFile()">Remove</button>
      `;
    }
  }

  window.clearSelectedUploadFile = function() {
    fileInput.value = "";
    if (preview) {
      preview.style.display = "none";
      preview.innerHTML = "";
    }
  };

  // Form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector("button[type='submit']");
    const file = fileInput.files[0];

    if (!file) {
      window.CLASS_HUB_UTILS.showToast("Please choose a file to upload.", "warning");
      return;
    }

    // Check 50MB file size limit
    if (file.size > 52428800) {
      window.CLASS_HUB_UTILS.showToast("File size exceeds 50MB limit.", "danger");
      return;
    }

    const title = document.getElementById("upload-title").value.trim();
    const description = document.getElementById("upload-desc").value.trim();
    const subjectId = document.getElementById("upload-subject").value;
    const sectionType = document.getElementById("upload-section").value;
    const category = document.getElementById("upload-category").value;

    if (!title || !subjectId || !sectionType || !category) {
      window.CLASS_HUB_UTILS.showToast("Please fill in all required fields.", "warning");
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner spinner-sm spinner-light"></span> Uploading...`;

      // Generate unique file path in Supabase Storage
      const fileExt = file.name.split(".").pop();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `${subjectId}/${sectionType}/${Date.now()}_${sanitizedName}`;

      // Upload file to Supabase storage bucket `academic-documents`
      const { data: storageData, error: storageError } = await window.supabaseClient.storage
        .from("academic-documents")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false
        });

      if (storageError) throw storageError;

      // Save document record in PostgreSQL
      const user = await window.CLASS_HUB_AUTH.getCurrentUser();
      const { data: docRecord, error: dbError } = await window.supabaseClient
        .from("documents")
        .insert({
          title,
          description,
          subject_id: subjectId,
          section_type: sectionType,
          category,
          storage_path: storagePath,
          original_file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          file_size: file.size,
          uploaded_by: user.id
        })
        .select()
        .single();

      if (dbError) throw dbError;

      window.CLASS_HUB_UTILS.showToast("Document uploaded successfully!", "success");
      form.reset();
      window.clearSelectedUploadFile();
      window.CLASS_HUB_UTILS.closeModal("modal-upload-document");
      await loadDocuments();
    } catch (err) {
      console.error("Upload error:", err);
      window.CLASS_HUB_UTILS.showToast(err.message || "Failed to upload document.", "danger");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Upload Document`;
    }
  });
}

// 6. Delete document (Admin only)
window.deleteDocument = async function(docId, storagePath) {
  if (!confirm("Are you sure you want to permanently delete this document?")) return;

  try {
    // Delete from storage
    if (storagePath) {
      await window.supabaseClient.storage
        .from("academic-documents")
        .remove([storagePath]);
    }

    // Delete from database
    const { error } = await window.supabaseClient
      .from("documents")
      .delete()
      .eq("id", docId);

    if (error) throw error;

    window.CLASS_HUB_UTILS.showToast("Document deleted successfully.", "success");
    await loadDocuments();
  } catch (err) {
    console.error("Delete error:", err);
    window.CLASS_HUB_UTILS.showToast("Failed to delete document.", "danger");
  }
};
