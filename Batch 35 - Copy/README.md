# CLASS HUB — Batch 35 — BSSE (Afternoon)

> **Official Academic Portal for University Students & Faculty**  
> Developed for **Batch 35 — BSSE (Afternoon)**. Powered by Vanilla HTML5/CSS3/JavaScript, Supabase (PostgreSQL, Auth, Storage, RLS), and hosted on Vercel.

---

## 🔑 Ready-to-Use Login Credentials

After running the database migration and seed script in your Supabase project (see [Database Setup](#-step-by-step-supabase-database-setup)), you can log in immediately using the following provisioned accounts:

### 1. 👑 Head Administrator Account (1 of 1)
* **Assigned Username:** `headadmin`
* **Email:** `headadmin@batch35.edu`
* **Password:** `AdminPassword35!`
* **Authority:** Highest authority; manages 9 normal Admins, 40 Students, portal settings, audit activity logs, subjects, lectures, and documents.

### 2. 🛡️ Normal Administrator Account (1 of 9)
* **Assigned Username:** `admin_cr`
* **Email:** `admin@batch35.edu`
* **Password:** `AdminPassword35!`
* **Authority:** Manages student accounts, schedules weekly tasks, uploads academic documents, posts announcements, and replies to student queries.

### 3. 🎓 Student Account (1 of 40)
* **Assigned Username:** `student_01`
* **Email:** `student01@batch35.edu`
* **Password:** `StudentPassword35!`
* **Authority:** Enrolled student; views weekly summaries, browses theory & lab lecture notes, downloads slides/manuals, and submits questions to class administrators.

---

## 📖 Table of Contents
1. [Project Overview](#-project-overview)
2. [Technology Stack](#-technology-stack)
3. [Project Directory Structure](#-project-directory-structure)
4. [Step-by-Step Supabase Database Setup](#-step-by-step-supabase-database-setup)
5. [Storage Bucket Setup](#-storage-bucket-setup)
6. [Configuring Supabase in Frontend](#-configuring-supabase-in-frontend)
7. [Local Testing Instructions](#-local-testing-instructions)
8. [Vercel Deployment Guide](#-vercel-deployment-guide)
9. [Security Architecture & Account Limits](#-security-architecture--account-limits)

---

## 🌟 Project Overview

**CLASS HUB** is an academic management website built specifically for university classes to centralize course materials and announcements. It eliminates the problem of lost assignment deadlines and missing documents caused by changing phone numbers or missing WhatsApp announcements.

### Key Capabilities:
* **Weekly Task Scheduler:** Live countdowns for Assignments, Lab Reports, Vivas, Quizzes, and Project deadlines.
* **Curriculum Subjects (6 Core Courses):**
  1. `DLD` — Digital Logic Design (Theory & Lab)
  2. `CN` — Computer Networks (Theory & Lab)
  3. `HCI & G` — Human-Computer Interaction & Graphics (Theory & Lab)
  4. `SC & D` — Software Construction & Development (Theory & Lab, editable by Head Admin)
  5. `WE` — Web Engineering (Theory & Lab)
  6. `AOA` — Analysis of Algorithms (Theory & Lab)
* **Theory & Lab Section Navigation:** Seamless switching between theory notes and practical lab exercises.
* **Document Repository:** Upload and download PDFs, slides, lab manuals, and assignments via Supabase Storage.
* **Student Helpdesk:** Interactive query system where students ask questions and receive answers from class representatives.
* **Course External Links:** One-click safe access to Google Classroom and University LMS portals.
* **50-Account Hard Limit:** Strictly enforced in PostgreSQL (40 Students, 9 Admins, 1 Head Admin).

---

## 💻 Technology Stack

* **Frontend:** HTML5 (Semantic Landmarks), CSS3 (Flexbox & Grid, CSS Custom Properties), Vanilla Modern JavaScript (ES6+ Modules, async/await).
* **Backend & Database:** Supabase PostgreSQL with Row Level Security (RLS) on all 12 tables.
* **Authentication:** Supabase Auth (supports login by assigned username OR email).
* **File Storage:** Supabase Storage bucket (`academic-documents`, 50MB limit).
* **Hosting:** Vercel (static site with clean URLs).

---

## 📂 Project Directory Structure

```
Batch 35/
├── index.html                   # Landing page & automatic role-based redirect
├── login.html                   # Official branded login page (username/email login)
├── vercel.json                  # Vercel deployment configuration
├── .env.example                 # Example environment variables
├── .gitignore                   # Git exclusions
├── README.md                    # Complete project documentation
│
├── student/                     # Student Portal Views
│   ├── dashboard.html           # Weekly summary, announcements, tasks, subject cards
│   ├── subjects.html            # All subjects curriculum list
│   ├── subject.html             # Reusable subject detail (Theory/Lab toggle, lectures, docs)
│   ├── documents.html           # Document browser with search & category filters
│   ├── queries.html             # Query desk (submit question & view admin replies)
│   └── profile.html             # Verified student identity & display name
│
├── admin/                       # Administrator Portal Views
│   ├── dashboard.html           # Admin stats overview & 50-account capacity tracker
│   ├── students.html            # Manage students (provision, activate/deactivate, reset PW)
│   ├── subjects.html            # View subjects
│   ├── lectures.html            # Add, edit, and delete lectures
│   ├── documents.html           # Upload files to storage & manage documents
│   ├── announcements.html       # Publish urgent/important class announcements
│   ├── weekly-tasks.html        # Schedule deadlines, assignments, and vivas
│   ├── links.html               # Manage Google Classroom and LMS URLs
│   └── queries.html             # Answer student questions & update status
│
├── head-admin/                  # Head Administrator Console Views
│   ├── dashboard.html           # Central console, capacity gauge, audit activity logs
│   ├── admins.html              # Manage up to 9 normal Administrator accounts
│   ├── students.html            # Manage student accounts
│   └── settings.html            # Configure class title, subjects, and theory/lab toggles
│
├── css/                         # Modular Stylesheets
│   ├── style.css                # Color variables, typography, reset, buttons, toasts
│   ├── navbar.css               # Header, branding, desktop nav, mobile drawer
│   ├── cards.css                # Subject cards, stat metrics, document & task items
│   ├── dashboard.css            # Two-column dashboard, weekly summary highlight box
│   ├── forms.css                # Inputs, modals (<dialog>), file drop zone, validation
│   ├── admin.css                # Admin data tables, capacity bar, activity logs
│   └── responsive.css           # Mobile breakpoint rules (touch-friendly targets)
│
├── js/                          # Vanilla JavaScript Feature Modules
│   ├── config.js                # Supabase client initialization & key helper banner
│   ├── auth.js                  # Session checks, requireAuth() guard, login/logout
│   ├── main.js                  # Toast alerts, date formatting, escapeHtml XSS protection
│   ├── dashboard.js             # Student dashboard live data controller
│   ├── subjects.js              # Subject listing & detail view controller
│   ├── lectures.js              # Lecture browser & admin lecture CRUD
│   ├── documents.js             # Document filtering & Supabase Storage upload/delete
│   ├── announcements.js         # Announcement feed & admin management
│   ├── weekly-tasks.js          # Task countdown & deadline scheduler
│   ├── queries.js               # Student queries & admin reply threads
│   ├── admin.js                 # Admin dashboard stats, student provisioning, course links
│   └── head-admin.js            # Head admin stats, admin provisioning, settings, audit logs
│
└── supabase/                    # Database Setup
    ├── migrations/
    │   └── 001_initial_schema.sql  # Complete schema, triggers, RLS policies, functions
    ├── seed.sql                 # Default subjects & initial account provisioning script
    └── README.md                # Dedicated Supabase setup guide
```

---

## 🚀 Step-by-Step Supabase Database Setup

Follow these simple steps to set up your backend in Supabase:

### Step 1: Create a Free Project in Supabase
1. Sign in or register at [https://supabase.com](https://supabase.com).
2. Click **New Project** and name it `Class-Hub-Batch-35`.
3. Set a strong database password and select your closest region.

### Step 2: Apply the Database Migration
1. Go to the **SQL Editor** in your Supabase dashboard left menu.
2. Click **New query**.
3. Open the file `supabase/migrations/001_initial_schema.sql` from this project.
4. Copy the entire contents, paste it into the Supabase SQL editor, and click **Run**.
5. All 12 tables, indexes, security functions, triggers, and Row Level Security policies will be created automatically.

### Step 3: Run the Seed Script & Provision Initial Accounts
1. Open a new query in the Supabase SQL Editor.
2. Open `supabase/seed.sql` from this project.
3. Copy the entire contents, paste it into the SQL editor, and click **Run**.
4. This seeds the 6 default subjects and provisions:
   * **Head Admin:** `headadmin` / `AdminPassword35!`
   * **Normal Admin:** `admin_cr` / `AdminPassword35!`
   * **Student:** `student_01` / `StudentPassword35!`

---

## 📦 Storage Bucket Setup

The SQL migration automatically initializes the `academic-documents` bucket in Supabase Storage.
To verify:
1. Go to **Storage** in your Supabase Dashboard.
2. Confirm the bucket `academic-documents` is present.
3. If you need to create it manually:
   * Click **New bucket**.
   * Name: `academic-documents`
   * Set **Public bucket** to `ON`.
   * Click **Save bucket**.

---

## ⚙️ Configuring Supabase in Frontend

You have two easy options to connect your website to your Supabase project:

### Option A: Quick In-Browser Configuration (Zero-setup)
1. Open `index.html` or `login.html` in your web browser.
2. A yellow setup banner will appear at the top: *"Supabase Setup Required"*.
3. Click **Configure Keys**.
4. Enter your **Supabase Project URL** (e.g. `https://xyzcompany.supabase.co`) and **Anon Key**.
5. The credentials will be saved safely in your browser and live queries will start immediately!

### Option B: Direct in `js/config.js`
Open `js/config.js` and replace the placeholder values at the top:
```javascript
const DEFAULT_SUPABASE_URL = "https://your-project-id.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "your-anon-key-here";
```

---

## 🧪 Local Testing Instructions

1. Open `index.html` or `login.html` in any browser or launch a local web server:
   ```powershell
   # Using Python 3
   python -m http.server 8000
   ```
2. Navigate to `http://localhost:8000/login.html`.
3. **Test Student Login:**
   * Enter username `student_01` and password `StudentPassword35!`.
   * Verified: Redirects to `student/dashboard.html`.
   * Try opening subjects, downloading documents, or submitting a query.
4. **Test Normal Admin Login:**
   * Log out and log in with username `admin_cr` and password `AdminPassword35!`.
   * Verified: Redirects to `admin/dashboard.html`.
   * Try provisioning a student, posting an announcement, or uploading a lecture file.
5. **Test Head Admin Login:**
   * Log out and log in with username `headadmin` and password `AdminPassword35!`.
   * Verified: Redirects to `head-admin/dashboard.html`.
   * Try provisioning a normal admin, checking activity logs, or editing portal settings.

---

## 🌐 Vercel Deployment Guide

Deploying CLASS HUB to Vercel takes less than 2 minutes:

1. Push this folder to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Class Hub Batch 35"
   git remote add origin https://github.com/your-username/class-hub-batch-35.git
   git push -u origin main
   ```
2. Go to [https://vercel.com](https://vercel.com) and log in.
3. Click **Add New** &rarr; **Project**.
4. Import your GitHub repository.
5. In **Build and Output Settings**, leave Framework as **Other** (it's static HTML/CSS/JS).
6. Click **Deploy**.
7. In your Supabase Dashboard, navigate to **Authentication** &rarr; **URL Configuration** and add your production Vercel URL to the **Redirect URLs** list.

---

## 🛡️ Security Architecture & Account Limits

* **50 Accounts Maximum:** PostgreSQL trigger `trg_enforce_account_limits` enforces:
  * Maximum 40 active student accounts.
  * Maximum 9 active normal admin accounts.
  * Exactly 1 Head Admin account.
  * Attempting to provision a 41st student or 10th admin will be rejected by the database.
* **Public Registration Disabled:** New accounts can only be provisioned by authorized administrators via `admin_create_account()`.
* **Zero Service-Role Secrets in Frontend:** Client uses only the anonymous publishable key; database security is handled by PostgreSQL Row Level Security (RLS).
* **Protected Head Admin:** Triggers prevent ordinary admins or students from demoting, modifying, or deactivating the Head Admin.
