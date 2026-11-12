BEGIN;

CREATE OR REPLACE FUNCTION public.w4_restore_session(p_token uuid)
RETURNS TABLE(id uuid, full_name_ru text, role public.user_role, organization_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
    SELECT p.id, p.full_name_ru, p.role, p.organization_id
    FROM atu_private.web_sessions s
    JOIN public.profiles p ON p.id = s.profile_id
    WHERE s.token_hash = sha256(convert_to(p_token::text, 'UTF8'))
      AND s.expires_at > now()
      AND p.is_active;
$$;

REVOKE EXECUTE ON FUNCTION public.w4_restore_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.w4_restore_session(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
