/**
 * ==============================================================================
 * BATCH 35 — BSSE (Afternoon) — CLASS HUB
 * Supabase Client Configuration & Auto-Initialization
 * ==============================================================================
 */

// Production configuration values for Batch 35
const DEFAULT_SUPABASE_URL = "https://uutsbqgdkasfayeqhvrm.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_Q1S26CACG0G7v8pGfjFuuA_rAwCPh90";

// Clean up any stale or corrupted keys previously saved in user's browser localStorage
try {
  const currentStoredKey = localStorage.getItem("CLASS_HUB_SUPABASE_ANON_KEY");
  if (currentStoredKey && currentStoredKey !== DEFAULT_SUPABASE_ANON_KEY) {
    localStorage.removeItem("CLASS_HUB_SUPABASE_ANON_KEY");
  }
  const currentStoredUrl = localStorage.getItem("CLASS_HUB_SUPABASE_URL");
  if (currentStoredUrl && currentStoredUrl !== DEFAULT_SUPABASE_URL) {
    localStorage.removeItem("CLASS_HUB_SUPABASE_URL");
  }
} catch (_) {}

// Helper: Validate HTTP/HTTPS URLs
function isValidHttpUrl(str) {
  if (!str || typeof str !== "string") return false;
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch (_) {
    return false;
  }
}

// Active configuration (prefers production default, supports environment variables or custom overrides)
const SUPABASE_URL = window.__ENV__?.SUPABASE_URL || DEFAULT_SUPABASE_URL || localStorage.getItem("CLASS_HUB_SUPABASE_URL");
const SUPABASE_ANON_KEY = window.__ENV__?.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY || localStorage.getItem("CLASS_HUB_SUPABASE_ANON_KEY");

// Check if credentials are valid
const isSupabaseConfigured = () => {
  return Boolean(
    isValidHttpUrl(SUPABASE_URL) && 
    !SUPABASE_URL.includes("your-project-id") &&
    SUPABASE_ANON_KEY && 
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_ANON_KEY.includes("your-anon-key")
  );
};

// Initialize Supabase client
function initSupabaseClient() {
  if (window.supabaseClient) {
    return window.supabaseClient;
  }

  // Look for the loaded Supabase SDK
  const sdk = window.supabase;
  if (!sdk || typeof sdk.createClient !== "function") {
    console.warn("Supabase SDK is not yet available on window.supabase. Will retry once scripts finish loading.");
    return null;
  }

  try {
    window.supabaseClient = sdk.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return window.supabaseClient;
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
    return null;
  }
}

// Attempt immediate initialization
initSupabaseClient();

// Re-attempt upon DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  if (!window.supabaseClient) {
    initSupabaseClient();
  }

  // Only display setup banner if placeholder/missing credentials
  if (!isSupabaseConfigured()) {
    const banner = document.createElement("aside");
    banner.setAttribute("aria-label", "Configuration Warning");
    banner.style.cssText = `
      background-color: #fef3c7;
      color: #92400e;
      border-bottom: 2px solid #f59e0b;
      padding: 0.75rem 1.5rem;
      font-size: 0.875rem;
      text-align: center;
      position: sticky;
      top: 0;
      z-index: 99999;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    `;
    banner.innerHTML = `
      <span><strong>Supabase Setup Required:</strong> Please connect your Supabase project (URL & Anon Key) to enable authentication and live database queries.</span>
      <button type="button" id="btn-quick-config" style="background:#b45309;color:#fff;border:none;padding:0.3rem 0.75rem;border-radius:4px;font-weight:600;cursor:pointer;font-size:0.8rem;">
        Configure Keys
      </button>
    `;
    document.body.prepend(banner);

    document.getElementById("btn-quick-config")?.addEventListener("click", () => {
      const url = prompt("Enter your Supabase Project URL (e.g., https://xyz.supabase.co):", SUPABASE_URL === DEFAULT_SUPABASE_URL ? "" : SUPABASE_URL);
      if (!url) return;
      const key = prompt("Enter your Supabase Anon / Publishable Key:", SUPABASE_ANON_KEY === DEFAULT_SUPABASE_ANON_KEY ? "" : SUPABASE_ANON_KEY);
      if (!key) return;
      saveSupabaseConfig(url, key);
    });
  }
});

// Function to update configuration dynamically if needed
function saveSupabaseConfig(url, anonKey) {
  if (!url || !anonKey) return false;
  localStorage.setItem("CLASS_HUB_SUPABASE_URL", url.trim());
  localStorage.setItem("CLASS_HUB_SUPABASE_ANON_KEY", anonKey.trim());
  window.location.reload();
  return true;
}

// Export to window
window.CLASS_HUB_CONFIG = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  isConfigured: isSupabaseConfigured,
  initClient: initSupabaseClient,
  saveConfig: saveSupabaseConfig
};
