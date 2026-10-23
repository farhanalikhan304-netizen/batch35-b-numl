/**
 * ==============================================================================
 * BATCH 35 — BSSE (Afternoon) — CLASS HUB
 * Global Helper Functions & UI Utilities
 * ==============================================================================
 */

// 1. Toast Notification System
function showToast(message, type = "info", title = "") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "alert-container";
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.setAttribute("role", "alert");

  let defaultTitle = "";
  if (type === "success") defaultTitle = "Success";
  else if (type === "danger") defaultTitle = "Error";
  else if (type === "warning") defaultTitle = "Notice";
  else defaultTitle = "Info";

  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title || defaultTitle)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button type="button" class="toast-close" aria-label="Close notification">&times;</button>
  `;

  // Close toast on click
  toast.querySelector(".toast-close").addEventListener("click", () => {
    toast.remove();
  });

  container.appendChild(toast);

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (toast.isConnected) {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}

// 2. Safe HTML Escaping (prevents XSS)
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 3. Date & Time Formatters (Default timezone: Asia/Karachi)
function formatDate(dateString) {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  } catch {
    return dateString;
  }
}

function formatDateTime(dateString) {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  } catch {
    return dateString;
  }
}

function isDateOverdue(dateString) {
  if (!dateString) return false;
  return new Date(dateString) < new Date();
}

// 4. Modal Dialog Helpers (Native HTML5 dialog with light-dismiss & ESC support)
function openModal(dialogId) {
  const dialog = document.getElementById(dialogId);
  if (dialog && typeof dialog.showModal === "function") {
    dialog.showModal();
    // Focus first interactive control
    const firstInput = dialog.querySelector("input, select, textarea, button:not(.modal-close-btn)");
    if (firstInput) firstInput.focus();
  }
}

function closeModal(dialogId) {
  const dialog = document.getElementById(dialogId);
  if (dialog && typeof dialog.close === "function") {
    dialog.close();
  }
}

// Initialize Modal Close Handlers & Light Dismiss
document.addEventListener("DOMContentLoaded", () => {
  // Close buttons with data-close-modal
  document.querySelectorAll("[data-close-modal]").forEach(btn => {
    btn.addEventListener("click", () => {
      const modalId = btn.getAttribute("data-close-modal");
      closeModal(modalId);
    });
  });

  // Light dismiss: clicking dialog backdrop closes it
  document.querySelectorAll("dialog.modal-dialog").forEach(dialog => {
    dialog.addEventListener("click", (e) => {
      const rect = dialog.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) {
        dialog.close();
      }
    });
  });

  // Setup Mobile Nav Toggle
  setupMobileNav();
});

// 5. Mobile Navigation Setup
function setupMobileNav() {
  const toggleBtn = document.querySelector(".mobile-nav-toggle");
  const menu = document.querySelector(".mobile-nav-menu");

  if (toggleBtn && menu) {
    toggleBtn.addEventListener("click", () => {
      menu.classList.toggle("open");
      const isOpen = menu.classList.contains("open");
      toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }
}

// 6. Query Param Helper
function getUrlParam(key) {
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

// 7. Format File Size
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// Export utilities
window.CLASS_HUB_UTILS = {
  showToast,
  escapeHtml,
  formatDate,
  formatDateTime,
  isDateOverdue,
  openModal,
  closeModal,
  getUrlParam,
  formatFileSize
};
