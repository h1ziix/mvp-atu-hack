BEGIN;

CREATE TABLE IF NOT EXISTS atu_private.ai_usage (
    profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    usage_day date NOT NULL,
    requests integer NOT NULL,
    last_request timestamptz NOT NULL
);

CREATE OR REPLACE FUNCTION public.w3_claim_ai_request(p_token uuid, p_action text)
RETURNS TABLE(organization_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE
    actor public.profiles;
    allowed_roles public.user_role[];
    request_time timestamptz := now();
    request_day date := (request_time AT TIME ZONE 'UTC')::date;
BEGIN
    CASE p_action
        WHEN 'analysis' THEN allowed_roles := ARRAY['admin','inspector','management']::public.user_role[];
        WHEN 'ocr' THEN allowed_roles := ARRAY['admin','inspector']::public.user_role[];
        WHEN 'photo' THEN allowed_roles := ARRAY['responsible']::public.user_role[];
        WHEN 'voice' THEN allowed_roles := ARRAY['responsible']::public.user_role[];
        ELSE RAISE EXCEPTION 'Неизвестное действие.' USING ERRCODE = '22023';
    END CASE;
    actor := atu_private.w4_actor(p_token, allowed_roles);
    IF p_action IN ('photo','voice') AND NOT EXISTS (
        SELECT 1 FROM public.organizations o WHERE o.id = actor.organization_id AND o.is_active
    ) THEN
        RAISE EXCEPTION 'Нет доступа к организации.' USING ERRCODE = '42501';
    END IF;

    INSERT INTO atu_private.ai_usage AS usage (profile_id, usage_day, requests, last_request)
    VALUES (actor.id, request_day, 1, request_time)
    ON CONFLICT (profile_id) DO UPDATE
    SET usage_day = EXCLUDED.usage_day,
        requests = CASE WHEN usage.usage_day = request_day THEN usage.requests + 1 ELSE 1 END,
        last_request = request_time
    WHERE usage.last_request <= request_time - interval '4 seconds'
      AND (usage.usage_day <> request_day OR usage.requests < 60);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Лимит запросов ИИ.' USING ERRCODE = 'PT429';
    END IF;
    RETURN QUERY SELECT actor.organization_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.w3_claim_ai_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.w3_claim_ai_request(uuid, text) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
