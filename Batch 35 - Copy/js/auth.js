/**
 * ==============================================================================
 * BATCH 35 — BSSE (Afternoon) — CLASS HUB
 * Authentication & Session Management Module
 * ==============================================================================
 */

// Cache for current profile
let cachedProfile = null;

// Helper: Get root-relative path based on current location
function getRelativePath(targetPath) {
  // If targetPath starts with '/', determine how many levels deep we are
  const path = window.location.pathname;
  let prefix = "";
  if (path.includes("/student/") || path.includes("/admin/") || path.includes("/head-admin/")) {
    prefix = "../";
  }
  return prefix + targetPath.replace(/^\//, "");
}

// Helper: Ensure and get active Supabase client
function getClient() {
  if (!window.supabaseClient && window.CLASS_HUB_CONFIG?.initClient) {
    window.CLASS_HUB_CONFIG.initClient();
  }
  return window.supabaseClient;
}

// 1. Get current Supabase session
async function getCurrentSession() {
  const client = getClient();
  if (!client) return null;
  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error) {
      console.warn("Session retrieval error:", error.message);
      return null;
    }
    return session;
  } catch (err) {
    console.error("Failed to get session:", err);
    return null;
  }
}

// 2. Get current authenticated user
async function getCurrentUser() {
  const session = await getCurrentSession();
  return session ? session.user : null;
}

// 3. Fetch user profile from database
async function getCurrentProfile(forceRefresh = false) {
  if (cachedProfile && !forceRefresh) return cachedProfile;
  const user = await getCurrentUser();
  if (!user) return null;

  const client = getClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error || !data) {
      console.error("Failed to load user profile:", error);
      return null;
    }

    cachedProfile = data;
    return data;
  } catch (err) {
    console.error("Profile query error:", err);
    return null;
  }
}

// 4. Authenticate user with Username or Email
async function login(identifier, password) {
  const client = getClient();
  if (!client) {
    throw new Error("Supabase is not initialized. Please ensure scripts are loaded and refresh the page.");
  }

  const cleanIdentifier = identifier.trim();
  let email = cleanIdentifier;

  // If user entered a username (no '@' symbol), resolve it securely to their assigned email
  if (!cleanIdentifier.includes("@")) {
    const { data: resolvedEmail, error: rpcError } = await client
      .rpc("resolve_username_to_email", { p_username: cleanIdentifier });

    if (rpcError || !resolvedEmail) {
      throw new Error("Invalid username or password. Please verify your assigned credentials.");
    }
    email = resolvedEmail;
  }

  // Attempt Supabase authentication
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    if (authError.message.includes("Invalid login credentials")) {
      throw new Error("Invalid username or password. Please try again.");
    }
    throw new Error(authError.message || "Failed to sign in. Please try again.");
  }

  // Retrieve user profile to verify status and role
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role, status, full_name")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile) {
    await client.auth.signOut();
    throw new Error("Account profile not found. Please contact an administrator.");
  }

  // Reject inactive accounts
  if (profile.status !== "active") {
    await client.auth.signOut();
    throw new Error("Your account has been deactivated. Please contact your administrator.");
  }

  // Redirect to appropriate dashboard
  let redirectUrl = "student/dashboard.html";
  if (profile.role === "head_admin") {
    redirectUrl = "head-admin/dashboard.html";
  } else if (profile.role === "admin") {
    redirectUrl = "admin/dashboard.html";
  }

  return {
    user: authData.user,
    profile,
    redirectUrl: getRelativePath(redirectUrl)
  };
}

// 5. Secure Logout
async function logout() {
  try {
    const client = getClient();
    if (client) {
      await client.auth.signOut();
    }
  } catch (err) {
    console.warn("Logout error:", err);
  } finally {
    cachedProfile = null;
    window.location.href = getRelativePath("login.html");
  }
}

// 6. Route Guard: Enforce Authentication & Role Authorization
async function requireAuth(allowedRoles = ["student", "admin", "head_admin"]) {
  const client = getClient();
  if (!client) {
    console.warn("Supabase not fully configured yet.");
  }

  const session = await getCurrentSession();
  if (!session) {
    // Save intended destination for redirect
    sessionStorage.setItem("intended_destination", window.location.pathname + window.location.search);
    window.location.href = getRelativePath("login.html");
    return null;
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    await logout();
    return null;
  }

  // Check account active status
  if (profile.status !== "active") {
    alert("Your account is currently inactive. Please contact the administrator.");
    await logout();
    return null;
  }

  // Check allowed role permissions
  if (!allowedRoles.includes(profile.role)) {
    console.warn(`Unauthorized access attempt by ${profile.role} to role-restricted view.`);
    
    // Redirect to permitted dashboard
    if (profile.role === "head_admin") {
      window.location.href = getRelativePath("head-admin/dashboard.html");
    } else if (profile.role === "admin") {
      window.location.href = getRelativePath("admin/dashboard.html");
    } else {
      window.location.href = getRelativePath("student/dashboard.html");
    }
    return null;
  }

  // Populate navbar elements if they exist
  populateNavbarUser(profile);

  return profile;
}

// Helper: Populate Navbar User Elements
function populateNavbarUser(profile) {
  const userNameElements = document.querySelectorAll(".user-name");
  userNameElements.forEach(el => el.textContent = profile.full_name);

  const userRoleElements = document.querySelectorAll(".user-role-label");
  userRoleElements.forEach(el => {
    let roleDisplay = "Student";
    if (profile.role === "head_admin") roleDisplay = "Head Admin";
    else if (profile.role === "admin") roleDisplay = "Administrator";
    el.textContent = roleDisplay;
  });

  const userAvatarElements = document.querySelectorAll(".user-avatar");
  userAvatarElements.forEach(el => {
    const initials = profile.full_name
      .split(" ")
      .map(n => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
    el.textContent = initials || "U";
  });

  // Attach logout listener to all logout buttons
  document.querySelectorAll(".btn-logout").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (confirm("Are you sure you want to log out of Class Hub?")) {
        await logout();
      }
    });
  });
}

// Export Auth methods
window.CLASS_HUB_AUTH = {
  getCurrentSession,
  getCurrentUser,
  getCurrentProfile,
  login,
  logout,
  requireAuth,
  getRelativePath
};
