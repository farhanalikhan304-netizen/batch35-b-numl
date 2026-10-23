/**
 * ==============================================================================
 * BATCH 35 — BSSE (Afternoon) — CLASS HUB
 * Subject & Section Details Controller
 * ==============================================================================
 */

let currentSubject = null;
let currentSectionType = "theory";

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await window.CLASS_HUB_AUTH.requireAuth(["student", "admin", "head_admin"]);
  if (!profile) return;

  const subjectId = window.CLASS_HUB_UTILS.getUrlParam("id");
  if (subjectId) {
    // Subject Detail View
    loadSubjectDetail(subjectId);
  } else {
    // All Subjects Listing View
    loadAllSubjectsList();
  }
});

// 1. Load Subject Detail Page
async function loadSubjectDetail(subjectId) {
  try {
    const { data: subject, error } = await window.supabaseClient
      .from("subjects")
      .select(`
        id,
        name,
        code,
        description,
        subject_sections(section_type, is_active)
      `)
      .eq("id", subjectId)
      .single();

    if (error || !subject) {
      document.getElementById("subject-detail-container").innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3>Subject Not Found</h3>
          <p>The requested subject could not be loaded from the database.</p>
          <a href="subjects.html" class="btn btn-secondary">Back to Subjects</a>
        </div>
      `;
      return;
    }

    currentSubject = subject;

    // Render Subject Headers
    document.getElementById("subject-title").textContent = subject.name;
    document.getElementById("subject-code").textContent = subject.code;
    document.getElementById("subject-desc").textContent = subject.description || "No description provided.";
    document.title = `${subject.code} — ${subject.name} | CLASS HUB`;

    // Setup Section Switcher (Theory vs Lab)
    setupSectionSwitcher(subject.subject_sections || []);

    // Load initial section content (Theory by default)
    loadSectionContent(currentSectionType);

  } catch (err) {
    console.error("Error loading subject details:", err);
    window.CLASS_HUB_UTILS.showToast("Failed to load subject details.", "danger");
  }
}

// 2. Setup Section Switcher
function setupSectionSwitcher(sections) {
  const container = document.getElementById("section-switcher-container");
  if (!container) return;

  const hasTheory = sections.some(s => s.section_type === "theory" && s.is_active);
  const hasLab = sections.some(s => s.section_type === "lab" && s.is_active);

  if (!hasTheory && !hasLab) {
    container.innerHTML = `<p class="form-helper">No active sections available.</p>`;
    return;
  }

  // Set default active section
  currentSectionType = hasTheory ? "theory" : "lab";

  container.innerHTML = `
    <div class="section-switcher" role="tablist">
      ${hasTheory ? `
        <button type="button" class="section-switch-btn ${currentSectionType === 'theory' ? 'active' : ''}" data-section="theory" role="tab" aria-selected="${currentSectionType === 'theory'}">
          📖 Theory
        </button>
      ` : ""}
      ${hasLab ? `
        <button type="button" class="section-switch-btn ${currentSectionType === 'lab' ? 'active' : ''}" data-section="lab" role="tab" aria-selected="${currentSectionType === 'lab'}">
          🔬 Lab
        </button>
      ` : ""}
    </div>
  `;

  container.querySelectorAll(".section-switch-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".section-switch-btn").forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      currentSectionType = btn.getAttribute("data-section");
      loadSectionContent(currentSectionType);
    });
  });
}

// 3. Load Section Content (Lectures, Documents, Links)
async function loadSectionContent(sectionType) {
  if (!currentSubject) return;

  loadCourseLinks(currentSubject.id, sectionType);
  loadSubjectLectures(currentSubject.id, sectionType);
  loadSubjectDocuments(currentSubject.id, sectionType);
}

// 4. Load Google Classroom & LMS Links
async function loadCourseLinks(subjectId, sectionType) {
  const container = document.getElementById("course-links-container");
  if (!container) return;

  try {
    const { data: link, error } = await window.supabaseClient
      .from("course_links")
      .select("*")
      .eq("subject_id", subjectId)
      .eq("section_type", sectionType)
      .maybeSingle();

    if (error) throw error;

    const classroomUrl = link?.google_classroom_url;
    const lmsUrl = link?.lms_url;
    const additionalUrl = link?.additional_resource_url;

    if (!classroomUrl && !lmsUrl && !additionalUrl) {
      container.innerHTML = `
        <span style="font-size:0.85rem;color:var(--text-light);font-style:italic;">
          No external Classroom or LMS links configured for this ${sectionType} section.
        </span>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
        ${classroomUrl ? `
          <a href="${window.CLASS_HUB_UTILS.escapeHtml(classroomUrl)}" target="_blank" rel="noopener noreferrer" class="course-link-btn classroom">
            📗 Google Classroom (${sectionType.toUpperCase()}) &rarr;
          </a>
        ` : ""}
        ${lmsUrl ? `
          <a href="${window.CLASS_HUB_UTILS.escapeHtml(lmsUrl)}" target="_blank" rel="noopener noreferrer" class="course-link-btn lms">
            🎓 University LMS (${sectionType.toUpperCase()}) &rarr;
          </a>
        ` : ""}
        ${additionalUrl ? `
          <a href="${window.CLASS_HUB_UTILS.escapeHtml(additionalUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline">
            🔗 Additional Course Resources &rarr;
          </a>
        ` : ""}
      </div>
    `;
  } catch (err) {
    console.error("Error loading course links:", err);
  }
}

// 5. Load Subject Lectures
async function loadSubjectLectures(subjectId, sectionType) {
  const container = document.getElementById("subject-lectures-list");
  if (!container) return;

  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><span>Loading lectures...</span></div>`;

  try {
    const { data: lectures, error } = await window.supabaseClient
      .from("lectures")
      .select("*")
      .eq("subject_id", subjectId)
      .eq("section_type", sectionType)
      .order("lecture_number", { ascending: true });

    if (error) throw error;

    if (!lectures || lectures.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <h3>No lectures uploaded</h3>
          <p>No lectures have been added for the ${sectionType} section yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = lectures.map(lec => `
      <article class="card" style="margin-bottom:1rem;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem;flex-wrap:wrap;gap:0.5rem;">
          <div>
            <span class="badge badge-primary">Lecture #${lec.lecture_number}</span>
            <h3 style="font-size:1.1rem;margin-top:0.35rem;">${window.CLASS_HUB_UTILS.escapeHtml(lec.title)}</h3>
          </div>
          <time style="font-size:0.8rem;color:var(--text-light);">${window.CLASS_HUB_UTILS.formatDate(lec.lecture_date)}</time>
        </div>
        ${lec.description ? `<p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.75rem;">${window.CLASS_HUB_UTILS.escapeHtml(lec.description)}</p>` : ""}
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
          ${lec.file_path ? `
            <a href="${window.CLASS_HUB_UTILS.escapeHtml(lec.file_path)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary">
              Download Lecture File
            </a>
          ` : ""}
          ${lec.external_url ? `
            <a href="${window.CLASS_HUB_UTILS.escapeHtml(lec.external_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline">
              External Slides / Video &rarr;
            </a>
          ` : ""}
        </div>
      </article>
    `).join("");
  } catch (err) {
    console.error("Error loading lectures:", err);
    container.innerHTML = `<p class="form-helper">Failed to load lectures.</p>`;
  }
}

// 6. Load Subject Documents
async function loadSubjectDocuments(subjectId, sectionType) {
  const container = document.getElementById("subject-documents-list");
  if (!container) return;

  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><span>Loading documents...</span></div>`;

  try {
    const { data: docs, error } = await window.supabaseClient
      .from("documents")
      .select("*")
      .eq("subject_id", subjectId)
      .eq("section_type", sectionType)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!docs || docs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📁</div>
          <h3>No documents available</h3>
          <p>No study materials or lab manuals uploaded for ${sectionType} yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = docs.map(doc => {
      // Determine file extension icon
      const ext = doc.original_file_name.split(".").pop().toUpperCase();
      const fileSize = window.CLASS_HUB_UTILS.formatFileSize(doc.file_size);

      return `
        <div class="document-item">
          <div class="doc-info">
            <div class="doc-icon">${ext || "FILE"}</div>
            <div class="doc-text">
              <h4>${window.CLASS_HUB_UTILS.escapeHtml(doc.title)}</h4>
              <div class="doc-meta">
                <span class="badge badge-normal">${window.CLASS_HUB_UTILS.escapeHtml(doc.category)}</span>
                <span>Size: ${fileSize}</span>
                <span>Uploaded: ${window.CLASS_HUB_UTILS.formatDate(doc.created_at)}</span>
              </div>
            </div>
          </div>
          <button type="button" class="btn btn-sm btn-primary" onclick="downloadDocumentFile('${doc.storage_path}', '${encodeURIComponent(doc.original_file_name)}')">
            Download &darr;
          </button>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Error loading documents:", err);
    container.innerHTML = `<p class="form-helper">Failed to load documents.</p>`;
  }
}

// Helper: Download Document from Supabase Storage
window.downloadDocumentFile = async function(storagePath, originalFileName) {
  try {
    const { data, error } = await window.supabaseClient.storage
      .from("academic-documents")
      .createSignedUrl(storagePath, 60); // 60 seconds temporary signed URL

    if (error || !data?.signedUrl) {
      // Fallback: public URL
      const { data: publicData } = window.supabaseClient.storage
        .from("academic-documents")
        .getPublicUrl(storagePath);
      
      if (publicData?.publicUrl) {
        window.open(publicData.publicUrl, "_blank");
        return;
      }
      throw error || new Error("Could not generate download URL.");
    }

    window.open(data.signedUrl, "_blank");
  } catch (err) {
    console.error("Download error:", err);
    window.CLASS_HUB_UTILS.showToast("Failed to download file. Please check permissions.", "danger");
  }
};

// 7. Load All Subjects List Page (student/subjects.html)
async function loadAllSubjectsList() {
  const container = document.getElementById("all-subjects-grid");
  if (!container) return;

  try {
    const { data: subjects, error } = await window.supabaseClient
      .from("subjects")
      .select(`
        id, 
        name, 
        code, 
        description,
        subject_sections(section_type, is_active)
      `)
      .order("code", { ascending: true });

    if (error) throw error;

    if (!subjects || subjects.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">📚</div>
          <h3>No subjects registered</h3>
          <p>Please check back later or contact your administrator.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = subjects.map(sub => {
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
            <span style="font-size:0.8rem;color:var(--text-light);">Course Details</span>
            <a href="subject.html?id=${sub.id}" class="btn btn-sm btn-primary">
              Open Subject &rarr;
            </a>
          </div>
        </article>
      `;
    }).join("");
  } catch (err) {
    console.error("Error loading all subjects:", err);
    container.innerHTML = `<p class="form-helper">Failed to load subjects list.</p>`;
  }
}
