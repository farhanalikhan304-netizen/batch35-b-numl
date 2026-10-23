# Supabase Database & Security Guide — CLASS HUB

### Batch 35 — BSSE (Afternoon)

This directory contains the database migration, seed scripts, and security policies for **CLASS HUB**.

---

## 1. Schema Overview

The database uses PostgreSQL on Supabase with Row Level Security (RLS) enabled on all 12 tables:

1. `portal_settings` — Global configuration (class name, subject titles, account limits).
2. `profiles` — User profile details linked to `auth.users(id)` (role, status, username).
3. `subjects` — Academic subjects (code, name, description, active state).
4. `subject_sections` — Theory and Lab section toggles per subject.
5. `lectures` — Subject lectures, dates, materials, and links.
6. `documents` — Academic documents stored in Supabase Storage with metadata.
7. `announcements` — Class announcements with priorities (Normal, Important, Urgent).
8. `weekly_tasks` — Upcoming academic deadlines, assignments, labs, vivas, quizzes.
9. `course_links` — Google Classroom and University LMS links.
10. `queries` — Student support questions.
11. `query_replies` — Administrator replies to student queries.
12. `activity_logs` — Audit log of administrative actions.

---

## 2. Setting Up in Supabase

### Step 1: Open the SQL Editor in Supabase
1. Go to your Supabase project dashboard at `https://supabase.com/dashboard`.
2. Click **SQL Editor** in the left sidebar.
3. Click **New query**.

### Step 2: Apply Migration
1. Copy the entire contents of `migrations/001_initial_schema.sql`.
2. Paste it into the SQL Editor and click **Run**.
3. Confirm that all tables, indexes, triggers, and RLS policies are created without errors.

### Step 3: Run the Seed Script
1. Open a new query in the SQL Editor.
2. Copy and paste `seed.sql`.
3. Click **Run** to seed the default 6 subjects (DLD, CN, HCI & G, SC & D, Web Engineering, AOA) and their theory/lab sections.

### Step 4: Provision the Initial Head Admin
1. Open the commented block at the bottom of `seed.sql`.
2. Edit the email, password, and username to your chosen Head Admin credentials:
   ```sql
   v_email := 'your-email@university.edu';
   v_password := 'YourStrongPassword123!';
   v_username := 'headadmin';
   v_full_name := 'Head Administrator';
   ```
3. Run this script in the Supabase SQL Editor.
4. Your Head Admin account is now ready! You can now log into the portal.

---

## 3. Account Limit & Enforcement

The database strictly enforces the 50-account limit via PostgreSQL triggers:
* **Head Admin**: Exactly 1 active account (`role = 'head_admin'`).
* **Normal Admins**: At most 9 active accounts (`role = 'admin'`).
* **Students**: At most 40 active accounts (`role = 'student'`).
* **Total Active Accounts**: At most 50.

If an administrator attempts to create a 41st student or 10th admin, the trigger throws an error and prevents insertion.
Public signups are completely disabled; accounts can only be provisioned by authorized admins using the secure `admin_create_account` function.

---

## 4. Supabase Storage Setup

The migration creates a storage bucket named `academic-documents` with:
* 50MB file size limit.
* Allowed MIME types: PDF, DOC, DOCX, PPT, PPTX, TXT, JPG, PNG, WEBP.
* Storage RLS policies:
  * Any authenticated student or admin can read/download documents.
  * Only `admin` and `head_admin` can upload, modify, or delete files.





2005FARHAN@ali