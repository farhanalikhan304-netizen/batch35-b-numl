-- ==============================================================================
-- BATCH 35 — BSSE (Afternoon) — CLASS HUB
-- Supabase Database Schema Migration
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. PORTAL SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.portal_settings (
    id TEXT PRIMARY KEY DEFAULT 'primary',
    class_title TEXT NOT NULL DEFAULT 'Batch 35 — BSSE (Afternoon)',
    portal_name TEXT NOT NULL DEFAULT 'CLASS HUB',
    timezone TEXT NOT NULL DEFAULT 'Asia/Karachi',
    max_students INTEGER NOT NULL DEFAULT 40,
    max_admins INTEGER NOT NULL DEFAULT 9,
    max_head_admins INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Insert default portal settings
INSERT INTO public.portal_settings (id, class_title, portal_name, timezone, max_students, max_admins, max_head_admins)
VALUES ('primary', 'Batch 35 — BSSE (Afternoon)', 'CLASS HUB', 'Asia/Karachi', 40, 9, 1)
ON CONFLICT (id) DO NOTHING;

-- 3. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('student', 'admin', 'head_admin')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- 4. ACCOUNT LIMIT & ROLE ENFORCEMENT TRIGGER
CREATE OR REPLACE FUNCTION public.check_account_limits_and_rules()
RETURNS TRIGGER AS $$
DECLARE
    v_active_students INTEGER;
    v_active_admins INTEGER;
    v_active_head_admins INTEGER;
    v_max_students INTEGER := 40;
    v_max_admins INTEGER := 9;
    v_max_head_admins INTEGER := 1;
BEGIN
    -- Read configured limits
    SELECT max_students, max_admins, max_head_admins 
    INTO v_max_students, v_max_admins, v_max_head_admins 
    FROM public.portal_settings 
    WHERE id = 'primary';

    -- Prevent modifying or deactivating the existing Head Admin
    IF TG_OP = 'UPDATE' THEN
        IF OLD.role = 'head_admin' AND (NEW.role != 'head_admin' OR NEW.status != 'active') THEN
            RAISE EXCEPTION 'The Head Admin cannot be modified to another role or deactivated.';
        END IF;
    END IF;

    -- If the account is or is becoming active, check maximum limits
    IF NEW.status = 'active' THEN
        -- Check Head Admin count
        IF NEW.role = 'head_admin' THEN
            SELECT COUNT(*) INTO v_active_head_admins FROM public.profiles 
            WHERE role = 'head_admin' AND status = 'active' AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
            IF v_active_head_admins >= v_max_head_admins THEN
                RAISE EXCEPTION 'Maximum Head Admin limit reached (%). Exactly 1 Head Admin is allowed.', v_max_head_admins;
            END IF;
        END IF;

        -- Check Admin count
        IF NEW.role = 'admin' THEN
            SELECT COUNT(*) INTO v_active_admins FROM public.profiles 
            WHERE role = 'admin' AND status = 'active' AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
            IF v_active_admins >= v_max_admins THEN
                RAISE EXCEPTION 'Maximum Normal Admin limit reached (%). Exactly % normal Admins allowed.', v_max_admins, v_max_admins;
            END IF;
        END IF;

        -- Check Student count
        IF NEW.role = 'student' THEN
            SELECT COUNT(*) INTO v_active_students FROM public.profiles 
            WHERE role = 'student' AND status = 'active' AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
            IF v_active_students >= v_max_students THEN
                RAISE EXCEPTION 'Maximum Student limit reached (%). Only % active students allowed.', v_max_students, v_max_students;
            END IF;
        END IF;

        -- Check overall 50 total limit
        IF (v_active_students + v_active_admins + v_active_head_admins + 1) > (v_max_students + v_max_admins + v_max_head_admins) THEN
            RAISE EXCEPTION 'Total portal capacity reached (50 accounts max: 40 Students, 9 Admins, 1 Head Admin).';
        END IF;
    END IF;

    NEW.updated_at := TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_account_limits ON public.profiles;
CREATE TRIGGER trg_enforce_account_limits
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.check_account_limits_and_rules();

-- 5. SUBJECTS TABLE
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_subjects_code ON public.subjects(code);

-- 6. SUBJECT SECTIONS (THEORY & LAB)
CREATE TABLE IF NOT EXISTS public.subject_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL CHECK (section_type IN ('theory', 'lab')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    CONSTRAINT uq_subject_section UNIQUE (subject_id, section_type)
);

CREATE INDEX IF NOT EXISTS idx_subject_sections_subject ON public.subject_sections(subject_id);

-- 7. LECTURES TABLE
CREATE TABLE IF NOT EXISTS public.lectures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL CHECK (section_type IN ('theory', 'lab')),
    lecture_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    lecture_date DATE NOT NULL DEFAULT CURRENT_DATE,
    file_path TEXT,
    external_url TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_lectures_subject_section ON public.lectures(subject_id, section_type);
CREATE INDEX IF NOT EXISTS idx_lectures_date ON public.lectures(lecture_date DESC);

-- 8. DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL CHECK (section_type IN ('theory', 'lab')),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT NOT NULL CHECK (category IN (
        'Lecture Notes', 
        'Slides', 
        'Lab Manuals', 
        'Lab Reports', 
        'Assignments', 
        'Past Papers', 
        'Reference Material', 
        'Other'
    )),
    storage_path TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    mime_type TEXT,
    file_size BIGINT,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_documents_subject_section ON public.documents(subject_id, section_type);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);

-- 9. ANNOUNCEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    section_type TEXT CHECK (section_type IN ('theory', 'lab')),
    priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Normal', 'Important', 'Urgent')),
    published_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_announcements_published ON public.announcements(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON public.announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_subject ON public.announcements(subject_id);

-- 10. WEEKLY TASKS TABLE
CREATE TABLE IF NOT EXISTS public.weekly_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    section_type TEXT CHECK (section_type IN ('theory', 'lab')),
    task_type TEXT NOT NULL DEFAULT 'Assignment' CHECK (task_type IN (
        'Assignment', 
        'Lab Report', 
        'Viva', 
        'Quiz', 
        'Project', 
        'Lecture', 
        'Submission', 
        'Other'
    )),
    due_date TIMESTAMPTZ NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Archived')),
    resource_url TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_weekly_tasks_due ON public.weekly_tasks(due_date ASC);
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_subject ON public.weekly_tasks(subject_id);
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_status ON public.weekly_tasks(status);

-- 11. COURSE LINKS (GOOGLE CLASSROOM, LMS, ETC.)
CREATE TABLE IF NOT EXISTS public.course_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL DEFAULT 'theory' CHECK (section_type IN ('theory', 'lab')),
    google_classroom_url TEXT DEFAULT '',
    lms_url TEXT DEFAULT '',
    additional_resource_url TEXT DEFAULT '',
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    CONSTRAINT uq_course_link UNIQUE (subject_id, section_type)
);

CREATE INDEX IF NOT EXISTS idx_course_links_subject ON public.course_links(subject_id);

-- 12. STUDENT QUERIES TABLE
CREATE TABLE IF NOT EXISTS public.queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_queries_student ON public.queries(student_id);
CREATE INDEX IF NOT EXISTS idx_queries_status ON public.queries(status);
CREATE INDEX IF NOT EXISTS idx_queries_subject ON public.queries(subject_id);

-- 13. QUERY REPLIES TABLE
CREATE TABLE IF NOT EXISTS public.query_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID NOT NULL REFERENCES public.queries(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_query_replies_query ON public.query_replies(query_id);

-- 14. ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON public.activity_logs(actor_id);

-- ==============================================================================
-- 15. HELPER SECURITY FUNCTIONS (SECURITY DEFINER)
-- ==============================================================================

-- Helper: Get role of currently authenticated user
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid() AND status = 'active';
    RETURN COALESCE(v_role, 'anonymous');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: Check if user is Head Admin
CREATE OR REPLACE FUNCTION public.is_head_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = p_user_id AND role = 'head_admin' AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: Check if user is Admin or Head Admin
CREATE OR REPLACE FUNCTION public.is_admin_or_head(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = p_user_id AND role IN ('admin', 'head_admin') AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Safe username-to-email resolution for login
-- Does not enumerate arbitrary tables or dump emails
CREATE OR REPLACE FUNCTION public.resolve_username_to_email(p_username TEXT)
RETURNS TEXT AS $$
DECLARE
    v_email TEXT;
BEGIN
    SELECT email INTO v_email 
    FROM public.profiles 
    WHERE LOWER(username) = LOWER(TRIM(p_username)) 
      AND status = 'active'
    LIMIT 1;
    
    RETURN v_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.resolve_username_to_email(TEXT) TO anon, authenticated;

-- Helper to safely log activity
CREATE OR REPLACE FUNCTION public.log_activity(
    p_action TEXT,
    p_target_type TEXT,
    p_target_id TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.activity_logs (actor_id, action, target_type, target_id, metadata)
    VALUES (auth.uid(), p_action, p_target_type, p_target_id, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe administrative account creation (Students by Admin/Head Admin; Admins only by Head Admin)
CREATE OR REPLACE FUNCTION public.admin_create_account(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_username TEXT,
    p_role TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_caller_role TEXT;
    v_new_user_id UUID;
    v_encrypted_pw TEXT;
BEGIN
    -- Verify caller
    v_caller_role := public.current_user_role();
    IF v_caller_role NOT IN ('admin', 'head_admin') THEN
        RAISE EXCEPTION 'Access denied. Only authorized administrators can create accounts.';
    END IF;

    -- Validate role permissions
    IF p_role = 'head_admin' THEN
        RAISE EXCEPTION 'Cannot create an additional Head Admin.';
    END IF;

    IF p_role = 'admin' AND v_caller_role != 'head_admin' THEN
        RAISE EXCEPTION 'Only the Head Admin can create Administrator accounts.';
    END IF;

    IF p_role NOT IN ('student', 'admin') THEN
        RAISE EXCEPTION 'Invalid role specified: %', p_role;
    END IF;

    -- Trim and validate parameters
    p_email := LOWER(TRIM(p_email));
    p_username := LOWER(TRIM(p_username));
    p_full_name := TRIM(p_full_name);

    IF p_email = '' OR p_username = '' OR p_full_name = '' OR LENGTH(p_password) < 6 THEN
        RAISE EXCEPTION 'Missing or invalid parameters. Password must be at least 6 characters.';
    END IF;

    -- Check if username exists
    IF EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(username) = p_username) THEN
        RAISE EXCEPTION 'Username "%" is already taken. Please choose another.', p_username;
    END IF;

    -- Check if email exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = p_email) THEN
        RAISE EXCEPTION 'Email "%" is already registered.', p_email;
    END IF;

    -- Generate UUID for auth.users
    v_new_user_id := gen_random_uuid();
    v_encrypted_pw := crypt(p_password, gen_salt('bf'));

    -- Insert into auth.users (Supabase native Auth table)
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        phone_change,
        phone_change_token,
        email_change_token_current,
        reauthentication_token,
        email_change_confirm_status,
        is_sso_user,
        is_anonymous,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_new_user_id,
        'authenticated',
        'authenticated',
        p_email,
        v_encrypted_pw,
        NOW(),
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        0,
        FALSE,
        FALSE,
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object('full_name', p_full_name, 'username', p_username, 'role', p_role),
        NOW(),
        NOW()
    );

    -- Insert into auth.identities (Required for login)
    INSERT INTO auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        v_new_user_id,
        v_new_user_id,
        v_new_user_id::text,
        jsonb_build_object('sub', v_new_user_id::text, 'email', p_email),
        'email',
        NOW(),
        NOW(),
        NOW()
    );

    -- Insert into public.profiles (trigger will enforce 40 students / 9 admins / 50 total limit)
    INSERT INTO public.profiles (
        id,
        full_name,
        username,
        email,
        role,
        status
    ) VALUES (
        v_new_user_id,
        p_full_name,
        p_username,
        p_email,
        p_role,
        'active'
    );

    -- Log activity
    PERFORM public.log_activity('CREATE_ACCOUNT', 'profiles', v_new_user_id::text, jsonb_build_object(
        'username', p_username,
        'role', p_role,
        'email', p_email
    ));

    RETURN jsonb_build_object(
        'success', TRUE,
        'id', v_new_user_id,
        'username', p_username,
        'email', p_email,
        'role', p_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_create_account(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Safe administrative account status toggle (activate / deactivate)
CREATE OR REPLACE FUNCTION public.admin_toggle_user_status(
    p_user_id UUID,
    p_new_status TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_caller_role TEXT;
    v_target_role TEXT;
BEGIN
    v_caller_role := public.current_user_role();
    IF v_caller_role NOT IN ('admin', 'head_admin') THEN
        RAISE EXCEPTION 'Access denied.';
    END IF;

    IF p_new_status NOT IN ('active', 'inactive') THEN
        RAISE EXCEPTION 'Invalid status: %', p_new_status;
    END IF;

    SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user_id;
    IF v_target_role IS NULL THEN
        RAISE EXCEPTION 'User not found.';
    END IF;

    IF v_target_role = 'head_admin' THEN
        RAISE EXCEPTION 'The Head Admin account cannot be deactivated.';
    END IF;

    IF v_target_role = 'admin' AND v_caller_role != 'head_admin' THEN
        RAISE EXCEPTION 'Only the Head Admin can change Administrator account status.';
    END IF;

    UPDATE public.profiles 
    SET status = p_new_status, updated_at = NOW() 
    WHERE id = p_user_id;

    PERFORM public.log_activity('TOGGLE_STATUS', 'profiles', p_user_id::text, jsonb_build_object(
        'new_status', p_new_status,
        'target_role', v_target_role
    ));

    RETURN jsonb_build_object('success', TRUE, 'user_id', p_user_id, 'status', p_new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_toggle_user_status(UUID, TEXT) TO authenticated;

-- Safe password reset by authorized administrators
CREATE OR REPLACE FUNCTION public.admin_reset_password(
    p_user_id UUID,
    p_new_password TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_caller_role TEXT;
    v_target_role TEXT;
    v_encrypted_pw TEXT;
BEGIN
    v_caller_role := public.current_user_role();
    IF v_caller_role NOT IN ('admin', 'head_admin') THEN
        RAISE EXCEPTION 'Access denied.';
    END IF;

    IF LENGTH(p_new_password) < 6 THEN
        RAISE EXCEPTION 'Password must be at least 6 characters long.';
    END IF;

    SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user_id;
    IF v_target_role IS NULL THEN
        RAISE EXCEPTION 'User not found.';
    END IF;

    IF v_target_role = 'head_admin' AND auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Cannot reset the Head Admin password through this workflow.';
    END IF;

    IF v_target_role = 'admin' AND v_caller_role != 'head_admin' THEN
        RAISE EXCEPTION 'Only the Head Admin can reset administrator passwords.';
    END IF;

    v_encrypted_pw := crypt(p_new_password, gen_salt('bf'));

    UPDATE auth.users 
    SET encrypted_password = v_encrypted_pw, updated_at = NOW()
    WHERE id = p_user_id;

    PERFORM public.log_activity('RESET_PASSWORD', 'profiles', p_user_id::text, jsonb_build_object(
        'target_role', v_target_role
    ));

    RETURN jsonb_build_object('success', TRUE, 'user_id', p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_reset_password(UUID, TEXT) TO authenticated;

-- Safe portal statistics function
CREATE OR REPLACE FUNCTION public.get_portal_stats()
RETURNS JSONB AS $$
DECLARE
    v_students_count INTEGER := 0;
    v_admins_count INTEGER := 0;
    v_head_admin_count INTEGER := 0;
    v_subjects_count INTEGER := 0;
    v_documents_count INTEGER := 0;
    v_announcements_count INTEGER := 0;
    v_tasks_count INTEGER := 0;
    v_open_queries_count INTEGER := 0;
BEGIN
    SELECT COUNT(*) INTO v_students_count FROM public.profiles WHERE role = 'student' AND status = 'active';
    SELECT COUNT(*) INTO v_admins_count FROM public.profiles WHERE role = 'admin' AND status = 'active';
    SELECT COUNT(*) INTO v_head_admin_count FROM public.profiles WHERE role = 'head_admin' AND status = 'active';
    SELECT COUNT(*) INTO v_subjects_count FROM public.subjects WHERE is_active = TRUE;
    SELECT COUNT(*) INTO v_documents_count FROM public.documents;
    SELECT COUNT(*) INTO v_announcements_count FROM public.announcements WHERE expires_at IS NULL OR expires_at > NOW();
    SELECT COUNT(*) INTO v_tasks_count FROM public.weekly_tasks WHERE status = 'Active';
    SELECT COUNT(*) INTO v_open_queries_count FROM public.queries WHERE status = 'Open';

    RETURN jsonb_build_object(
        'active_students', v_students_count,
        'active_admins', v_admins_count,
        'active_head_admins', v_head_admin_count,
        'total_active_accounts', (v_students_count + v_admins_count + v_head_admin_count),
        'remaining_capacity', (50 - (v_students_count + v_admins_count + v_head_admin_count)),
        'total_subjects', v_subjects_count,
        'total_documents', v_documents_count,
        'total_announcements', v_announcements_count,
        'active_tasks', v_tasks_count,
        'open_queries', v_open_queries_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_portal_stats() TO authenticated;

-- ==============================================================================
-- 16. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.portal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- A. portal_settings
CREATE POLICY "Anyone can view portal settings"
ON public.portal_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only Head Admin can update portal settings"
ON public.portal_settings FOR UPDATE
TO authenticated
USING (public.is_head_admin());

-- B. profiles
-- Authenticated users can view active profiles or their own profile
CREATE POLICY "Authenticated users can view basic profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (status = 'active' OR id = auth.uid() OR public.is_admin_or_head());

-- Users can only update their own non-sensitive details (full_name)
CREATE POLICY "Users can update own display name"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
    id = auth.uid() AND
    role = (SELECT role FROM public.profiles WHERE id = auth.uid()) AND
    username = (SELECT username FROM public.profiles WHERE id = auth.uid()) AND
    email = (SELECT email FROM public.profiles WHERE id = auth.uid()) AND
    status = (SELECT status FROM public.profiles WHERE id = auth.uid())
);

-- C. subjects
CREATE POLICY "Anyone authenticated can view active subjects"
ON public.subjects FOR SELECT
TO authenticated
USING (is_active = true OR public.is_admin_or_head());

CREATE POLICY "Admins can insert subjects"
ON public.subjects FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_head());

CREATE POLICY "Admins can update subjects"
ON public.subjects FOR UPDATE
TO authenticated
USING (public.is_admin_or_head())
WITH CHECK (public.is_admin_or_head());

CREATE POLICY "Admins can delete subjects"
ON public.subjects FOR DELETE
TO authenticated
USING (public.is_admin_or_head());

-- D. subject_sections
CREATE POLICY "Anyone authenticated can view active sections"
ON public.subject_sections FOR SELECT
TO authenticated
USING (is_active = true OR public.is_admin_or_head());

CREATE POLICY "Admins can manage subject sections"
ON public.subject_sections FOR ALL
TO authenticated
USING (public.is_admin_or_head())
WITH CHECK (public.is_admin_or_head());

-- E. lectures
CREATE POLICY "Anyone authenticated can view lectures"
ON public.lectures FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert lectures"
ON public.lectures FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_head());

CREATE POLICY "Admins can update lectures"
ON public.lectures FOR UPDATE
TO authenticated
USING (public.is_admin_or_head())
WITH CHECK (public.is_admin_or_head());

CREATE POLICY "Admins can delete lectures"
ON public.lectures FOR DELETE
TO authenticated
USING (public.is_admin_or_head());

-- F. documents
CREATE POLICY "Anyone authenticated can view documents"
ON public.documents FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert documents"
ON public.documents FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_head());

CREATE POLICY "Admins can update documents"
ON public.documents FOR UPDATE
TO authenticated
USING (public.is_admin_or_head())
WITH CHECK (public.is_admin_or_head());

CREATE POLICY "Admins can delete documents"
ON public.documents FOR DELETE
TO authenticated
USING (public.is_admin_or_head());

-- G. announcements
CREATE POLICY "Anyone authenticated can view announcements"
ON public.announcements FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert announcements"
ON public.announcements FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_head());

CREATE POLICY "Admins can update announcements"
ON public.announcements FOR UPDATE
TO authenticated
USING (public.is_admin_or_head())
WITH CHECK (public.is_admin_or_head());

CREATE POLICY "Admins can delete announcements"
ON public.announcements FOR DELETE
TO authenticated
USING (public.is_admin_or_head());

-- H. weekly_tasks
CREATE POLICY "Anyone authenticated can view weekly tasks"
ON public.weekly_tasks FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert weekly tasks"
ON public.weekly_tasks FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_head());

CREATE POLICY "Admins can update weekly tasks"
ON public.weekly_tasks FOR UPDATE
TO authenticated
USING (public.is_admin_or_head())
WITH CHECK (public.is_admin_or_head());

CREATE POLICY "Admins can delete weekly tasks"
ON public.weekly_tasks FOR DELETE
TO authenticated
USING (public.is_admin_or_head());

-- I. course_links
CREATE POLICY "Anyone authenticated can view course links"
ON public.course_links FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage course links"
ON public.course_links FOR ALL
TO authenticated
USING (public.is_admin_or_head())
WITH CHECK (public.is_admin_or_head());

-- J. queries
-- Students only view own queries; Admins view all
CREATE POLICY "Students view own queries and Admins view all"
ON public.queries FOR SELECT
TO authenticated
USING (student_id = auth.uid() OR public.is_admin_or_head());

-- Students create own query
CREATE POLICY "Students can submit query"
ON public.queries FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());

-- Admins can update status of queries
CREATE POLICY "Admins can update queries"
ON public.queries FOR UPDATE
TO authenticated
USING (public.is_admin_or_head())
WITH CHECK (public.is_admin_or_head());

CREATE POLICY "Admins can delete queries"
ON public.queries FOR DELETE
TO authenticated
USING (public.is_admin_or_head());

-- K. query_replies
-- Students view replies for their query; Admins view all replies
CREATE POLICY "View replies for accessible queries"
ON public.query_replies FOR SELECT
TO authenticated
USING (
    public.is_admin_or_head() OR
    EXISTS (SELECT 1 FROM public.queries q WHERE q.id = query_replies.query_id AND q.student_id = auth.uid())
);

-- Only Admins can reply
CREATE POLICY "Admins can insert replies"
ON public.query_replies FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_head() AND admin_id = auth.uid());

-- L. activity_logs
-- Only Head Admin can view activity logs
CREATE POLICY "Only Head Admin can view activity logs"
ON public.activity_logs FOR SELECT
TO authenticated
USING (public.is_head_admin());

-- ==============================================================================
-- 17. STORAGE BUCKET CONFIGURATION & POLICIES
-- ==============================================================================

-- Create storage bucket for academic documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'academic-documents',
    'academic-documents',
    true,
    52428800, -- 50MB limit
    ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'image/jpeg',
        'image/png',
        'image/webp'
    ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Authenticated users can read documents
CREATE POLICY "Authenticated users can download documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'academic-documents');

-- Storage RLS: Only Admins and Head Admin can upload documents
CREATE POLICY "Admins can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'academic-documents' AND public.is_admin_or_head());

-- Storage RLS: Only Admins and Head Admin can update/delete documents
CREATE POLICY "Admins can update documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'academic-documents' AND public.is_admin_or_head());

CREATE POLICY "Admins can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'academic-documents' AND public.is_admin_or_head());
