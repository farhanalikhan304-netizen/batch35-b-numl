-- ==============================================================================
-- BATCH 35 — BSSE (Afternoon) — CLASS HUB
-- Database Seed Data & Initial Accounts Setup
-- ==============================================================================

-- 1. SEED DEFAULT SUBJECTS
DO $$
DECLARE
    v_dld_id UUID;
    v_cn_id UUID;
    v_hcig_id UUID;
    v_scd_id UUID;
    v_we_id UUID;
    v_aoa_id UUID;
BEGIN
    -- 1. DLD
    INSERT INTO public.subjects (name, code, description, is_active)
    VALUES ('Digital Logic Design', 'DLD', 'Digital Logic Design covering Boolean algebra, logic gates, combinational and sequential circuit design.', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
    RETURNING id INTO v_dld_id;

    IF v_dld_id IS NULL THEN
        SELECT id INTO v_dld_id FROM public.subjects WHERE code = 'DLD';
    END IF;

    INSERT INTO public.subject_sections (subject_id, section_type) VALUES (v_dld_id, 'theory') ON CONFLICT DO NOTHING;
    INSERT INTO public.subject_sections (subject_id, section_type) VALUES (v_dld_id, 'lab') ON CONFLICT DO NOTHING;

    -- 2. CN
    INSERT INTO public.subjects (name, code, description, is_active)
    VALUES ('Computer Networks', 'CN', 'Fundamentals of data communication, OSI/TCP-IP models, routing protocols, and network architecture.', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
    RETURNING id INTO v_cn_id;

    IF v_cn_id IS NULL THEN
        SELECT id INTO v_cn_id FROM public.subjects WHERE code = 'CN';
    END IF;

    INSERT INTO public.subject_sections (subject_id, section_type) VALUES (v_cn_id, 'theory') ON CONFLICT DO NOTHING;
    INSERT INTO public.subject_sections (subject_id, section_type) VALUES (v_cn_id, 'lab') ON CONFLICT DO NOTHING;

    -- 3. HCI & G
    INSERT INTO public.subjects (name, code, description, is_active)
    VALUES ('Human-Computer Interaction and Graphics', 'HCI & G', 'User interface design principles, cognitive ergonomics, usability heuristics, and computer graphics basics.', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
    RETURNING id INTO v_hcig_id;

    IF v_hcig_id IS NULL THEN
        SELECT id INTO v_hcig_id FROM public.subjects WHERE code = 'HCI & G';
    END IF;

    INSERT INTO public.subject_sections (subject_id, section_type) VALUES (v_hcig_id, 'theory') ON CONFLICT DO NOTHING;
    INSERT INTO public.subject_sections (subject_id, section_type) VALUES (v_hcig_id, 'lab') ON CONFLICT DO NOTHING;

    -- 4. SC & D
    INSERT INTO public.subjects (name, code, description, is_active)
    VALUES ('Software Construction & Development', 'SC & D', 'Software construction techniques, defensive programming, refactoring, and quality engineering. (Title configurable by Head Admin).', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
    RETURNING id INTO v_scd_id;

    IF v_scd_id IS NULL THEN
        SELECT id INTO v_scd_id FROM public.subjects WHERE code = 'SC & D';
    END IF;

    INSERT INTO public.subject_sections (subject_id, section_type) VALUES (v_scd_id, 'theory') ON CONFLICT DO NOTHING;
    INSERT INTO public.subject_sections (subject_id, section_type) VALUES (v_scd_id, 'lab') ON CONFLICT DO NOTHING;

    -- 5. Web Engineering
    INSERT INTO public.subjects (name, code, description, is_active)
    VALUES ('Web Engineering', 'WE', 'Modern web architecture, client-side technologies, server-side development, REST APIs, and database connectivity.', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
    RETURNING id INTO v_we_id;

    IF v_we_id IS NULL THEN
        SELECT id INTO v_we_id FROM public.subjects WHERE code = 'WE';
    END IF;

    INSERT INTO public.subject_sections (subject_id, section_type) VALUES (v_we_id, 'theory') ON CONFLICT DO NOTHING;
    INSERT INTO public.subject_sections (subject_id, section_type) VALUES (v_we_id, 'lab') ON CONFLICT DO NOTHING;

    -- 6. AOA
    INSERT INTO public.subjects (name, code, description, is_active)
    VALUES ('Analysis of Algorithms', 'AOA', 'Design and analysis of efficient algorithms, asymptotic complexity, divide and conquer, dynamic programming, and greedy methods.', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
    RETURNING id INTO v_aoa_id;

    IF v_aoa_id IS NULL THEN
        SELECT id INTO v_aoa_id FROM public.subjects WHERE code = 'AOA';
    END IF;

    INSERT INTO public.subject_sections (subject_id, section_type) VALUES (v_aoa_id, 'theory') ON CONFLICT DO NOTHING;
    INSERT INTO public.subject_sections (subject_id, section_type) VALUES (v_aoa_id, 'lab') ON CONFLICT DO NOTHING;

    -- Default course links rows
    INSERT INTO public.course_links (subject_id, section_type, google_classroom_url, lms_url)
    VALUES 
        (v_dld_id, 'theory', '', ''),
        (v_dld_id, 'lab', '', ''),
        (v_cn_id, 'theory', '', ''),
        (v_cn_id, 'lab', '', ''),
        (v_hcig_id, 'theory', '', ''),
        (v_hcig_id, 'lab', '', ''),
        (v_scd_id, 'theory', '', ''),
        (v_scd_id, 'lab', '', ''),
        (v_we_id, 'theory', '', ''),
        (v_we_id, 'lab', '', ''),
        (v_aoa_id, 'theory', '', ''),
        (v_aoa_id, 'lab', '', '')
    ON CONFLICT (subject_id, section_type) DO NOTHING;

END $$;

-- ==============================================================================
-- 2. INITIAL ACCOUNTS PROVISIONING
-- ==============================================================================
-- 1. HEAD ADMIN ACCOUNT (1 of 1):
--    Username: headadmin
--    Email:    headadmin@batch35.edu
--    Password: AdminPassword35!
--
-- 2. NORMAL ADMIN ACCOUNT (1 of 9):
--    Username: admin_cr
--    Email:    admin@batch35.edu
--    Password: AdminPassword35!
--
-- 3. STUDENT ACCOUNT (1 of 40):
--    Username: student_01
--    Email:    student01@batch35.edu
--    Password: StudentPassword35!
-- ==============================================================================

DO $$
DECLARE
    v_ha_id UUID := gen_random_uuid();
    v_ad_id UUID := gen_random_uuid();
    v_st_id UUID := gen_random_uuid();

    v_admin_pw TEXT := crypt('AdminPassword35!', gen_salt('bf'));
    v_student_pw TEXT := crypt('StudentPassword35!', gen_salt('bf'));
BEGIN
    -- A. CREATE HEAD ADMIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'head_admin') THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
            confirmation_token, recovery_token, email_change_token_new, email_change,
            phone_change, phone_change_token, email_change_token_current, reauthentication_token,
            email_change_confirm_status, is_sso_user, is_anonymous,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', v_ha_id, 'authenticated', 'authenticated',
            'headadmin@batch35.edu', v_admin_pw, NOW(),
            '', '', '', '', '', '', '', '', 0, FALSE, FALSE,
            jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
            jsonb_build_object('full_name', 'Head Administrator', 'username', 'headadmin', 'role', 'head_admin'),
            NOW(), NOW()
        );

        INSERT INTO auth.identities (
            id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
        ) VALUES (
            v_ha_id, v_ha_id, v_ha_id::text,
            jsonb_build_object('sub', v_ha_id::text, 'email', 'headadmin@batch35.edu'),
            'email', NOW(), NOW(), NOW()
        );

        INSERT INTO public.profiles (id, full_name, username, email, role, status)
        VALUES (v_ha_id, 'Head Administrator', 'headadmin', 'headadmin@batch35.edu', 'head_admin', 'active');
    END IF;

    -- B. CREATE SAMPLE NORMAL ADMIN (CR)
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = 'admin_cr') THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
            confirmation_token, recovery_token, email_change_token_new, email_change,
            phone_change, phone_change_token, email_change_token_current, reauthentication_token,
            email_change_confirm_status, is_sso_user, is_anonymous,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', v_ad_id, 'authenticated', 'authenticated',
            'admin@batch35.edu', v_admin_pw, NOW(),
            '', '', '', '', '', '', '', '', 0, FALSE, FALSE,
            jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
            jsonb_build_object('full_name', 'Class Representative', 'username', 'admin_cr', 'role', 'admin'),
            NOW(), NOW()
        );

        INSERT INTO auth.identities (
            id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
        ) VALUES (
            v_ad_id, v_ad_id, v_ad_id::text,
            jsonb_build_object('sub', v_ad_id::text, 'email', 'admin@batch35.edu'),
            'email', NOW(), NOW(), NOW()
        );

        INSERT INTO public.profiles (id, full_name, username, email, role, status)
        VALUES (v_ad_id, 'Class Representative', 'admin_cr', 'admin@batch35.edu', 'admin', 'active');
    END IF;

    -- C. CREATE SAMPLE STUDENT
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = 'student_01') THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
            confirmation_token, recovery_token, email_change_token_new, email_change,
            phone_change, phone_change_token, email_change_token_current, reauthentication_token,
            email_change_confirm_status, is_sso_user, is_anonymous,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', v_st_id, 'authenticated', 'authenticated',
            'student01@batch35.edu', v_student_pw, NOW(),
            '', '', '', '', '', '', '', '', 0, FALSE, FALSE,
            jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
            jsonb_build_object('full_name', 'Ali Ahmed', 'username', 'student_01', 'role', 'student'),
            NOW(), NOW()
        );

        INSERT INTO auth.identities (
            id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
        ) VALUES (
            v_st_id, v_st_id, v_st_id::text,
            jsonb_build_object('sub', v_st_id::text, 'email', 'student01@batch35.edu'),
            'email', NOW(), NOW(), NOW()
        );

        INSERT INTO public.profiles (id, full_name, username, email, role, status)
        VALUES (v_st_id, 'Ali Ahmed', 'student_01', 'student01@batch35.edu', 'student', 'active');
    END IF;

END $$;
