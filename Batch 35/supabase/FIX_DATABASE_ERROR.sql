-- ==============================================================================
-- BATCH 35 — BSSE (Afternoon) — CLASS HUB
-- ONE-CLICK DATABASE & AUTHENTICATION REPAIR SCRIPT
-- ==============================================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- It fixes the "Database error querying schema" by:
-- 1. Populating required auth.identities records for all accounts.
-- 2. Fixing NULL token columns in auth.users that crash GoTrue Auth.
-- 3. Resetting known passwords for Head Admin, Admin, and Student.
-- 4. Updating the admin_create_account function to always create identities.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. FIX NULL TOKEN FIELDS IN auth.users
UPDATE auth.users SET 
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change = COALESCE(email_change, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    phone_change = COALESCE(phone_change, ''),
    phone_change_token = COALESCE(phone_change_token, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    reauthentication_token = COALESCE(reauthentication_token, ''),
    email_change_confirm_status = COALESCE(email_change_confirm_status, 0),
    is_sso_user = COALESCE(is_sso_user, FALSE),
    is_anonymous = COALESCE(is_anonymous, FALSE)
WHERE confirmation_token IS NULL 
   OR recovery_token IS NULL 
   OR email_change IS NULL 
   OR email_change_token_new IS NULL;

-- 2. INSERT MISSING RECORDS IN auth.identities (Required for login)
INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
)
SELECT 
    u.id,
    u.id,
    u.id::text,
    jsonb_build_object('sub', u.id::text, 'email', u.email),
    'email',
    NOW(),
    NOW(),
    NOW()
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
);

-- 3. ENSURE ACCURATE BCRYPT PASSWORDS FOR DEFAULT ACCOUNTS
UPDATE auth.users 
SET 
    encrypted_password = crypt('AdminPassword35!', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
WHERE email IN ('headadmin@batch35.edu', 'admin@batch35.edu');

UPDATE auth.users 
SET 
    encrypted_password = crypt('StudentPassword35!', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
WHERE email = 'student01@batch35.edu';

-- 4. UPDATE admin_create_account FUNCTION TO ALWAYS WRITE TO BOTH auth.users AND auth.identities
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

    -- Insert into auth.users with non-null token defaults
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

-- 5. ENSURE STORAGE BUCKET FOR ACADEMIC DOCUMENTS
INSERT INTO storage.buckets (id, name, public) 
VALUES ('academic-documents', 'academic-documents', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access for academic documents'
    ) THEN
        CREATE POLICY "Public Access for academic documents" 
        ON storage.objects FOR SELECT 
        USING (bucket_id = 'academic-documents');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated uploads for academic documents'
    ) THEN
        CREATE POLICY "Authenticated uploads for academic documents" 
        ON storage.objects FOR INSERT 
        TO authenticated 
        WITH CHECK (bucket_id = 'academic-documents');
    END IF;
END $$;

-- Confirmation output
DO $$
BEGIN
    RAISE NOTICE 'SUCCESS: Authentication tables repaired, identities created, and passwords updated!';
END $$;
