BEGIN;

-- Existing audit and validation triggers resolve the tables in public.
ALTER FUNCTION public.log_report_status_change() SET search_path = pg_catalog, public;
ALTER FUNCTION public.enforce_waste_record_rules() SET search_path = pg_catalog, public;

CREATE SCHEMA IF NOT EXISTS atu_private;
REVOKE ALL ON SCHEMA atu_private FROM PUBLIC;

CREATE TABLE IF NOT EXISTS atu_private.web_sessions (
    token_hash bytea PRIMARY KEY,
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL DEFAULT now() + interval '8 hours'
);
CREATE INDEX IF NOT EXISTS web_sessions_expiry_idx ON atu_private.web_sessions (expires_at);

CREATE OR REPLACE FUNCTION public.w4_sign_in(p_email text, p_password text)
RETURNS TABLE(id uuid, full_name_ru text, role public.user_role, organization_id uuid, token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, extensions
AS $$
DECLARE account record; session_token uuid := gen_random_uuid();
BEGIN
    SELECT a.* INTO account FROM public.authenticate_user(p_email, p_password) a;
    IF NOT FOUND THEN RETURN; END IF;
    DELETE FROM atu_private.web_sessions WHERE expires_at <= now();
    INSERT INTO atu_private.web_sessions(token_hash, profile_id)
    VALUES (sha256(convert_to(session_token::text, 'UTF8')), account.id);
    RETURN QUERY SELECT account.id, account.full_name_ru, account.role, account.organization_id, session_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.w4_sign_out(p_token uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog
AS $$
    DELETE FROM atu_private.web_sessions WHERE token_hash = sha256(convert_to(p_token::text, 'UTF8'));
$$;

CREATE OR REPLACE FUNCTION atu_private.w4_actor(p_token uuid, p_roles public.user_role[])
RETURNS public.profiles
LANGUAGE plpgsql STABLE SET search_path = pg_catalog
AS $$
DECLARE actor public.profiles;
BEGIN
    SELECT p.* INTO actor
    FROM atu_private.web_sessions s JOIN public.profiles p ON p.id = s.profile_id
    WHERE s.token_hash = sha256(convert_to(p_token::text, 'UTF8'))
      AND s.expires_at > now() AND p.is_active AND p.role = ANY(p_roles);
    IF NOT FOUND THEN RAISE EXCEPTION 'Нет доступа. Войдите в кабинет повторно.' USING ERRCODE = '42501'; END IF;
    RETURN actor;
END;
$$;

CREATE OR REPLACE FUNCTION public.w4_create_organization(p_token uuid, p_fields jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE org_id uuid; template_id uuid := (p_fields->>'template_id')::uuid;
BEGIN
    PERFORM atu_private.w4_actor(p_token, ARRAY['admin']::public.user_role[]);
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = template_id AND is_active) THEN
        RAISE EXCEPTION 'Выберите действующую организацию для копирования справочника.';
    END IF;
    IF coalesce(p_fields->>'code', '') !~ '^[a-z][a-z0-9_]{1,39}$'
        OR coalesce(trim(p_fields->>'name_ru'), '') = ''
        OR coalesce(trim(p_fields->>'org_type_ru'), '') = ''
        OR coalesce(trim(p_fields->>'building_ru'), '') = '' THEN
        RAISE EXCEPTION 'Заполните код, название, тип и адрес организации.';
    END IF;
    INSERT INTO public.organizations (
        code, name_ru, name_kz, org_type_ru, org_type_kz, building_ru, building_kz,
        is_laboratory, summary_rule, qr_code_token
    ) VALUES (
        p_fields->>'code', trim(p_fields->>'name_ru'),
        coalesce(nullif(trim(p_fields->>'name_kz'), ''), trim(p_fields->>'name_ru')),
        trim(p_fields->>'org_type_ru'),
        coalesce(nullif(trim(p_fields->>'org_type_kz'), ''), trim(p_fields->>'org_type_ru')),
        trim(p_fields->>'building_ru'),
        coalesce(nullif(trim(p_fields->>'building_kz'), ''), trim(p_fields->>'building_ru')),
        coalesce((p_fields->>'is_laboratory')::boolean, false),
        coalesce((p_fields->>'summary_rule')::public.summary_rule_type, 'monthly_by_item'),
        'atu-qr-' || gen_random_uuid()
    ) RETURNING id INTO org_id;

    INSERT INTO public.organization_waste_types (organization_id, waste_type_id, sort_order)
    SELECT org_id, c.waste_type_id, c.sort_order
    FROM public.organization_waste_types c
    JOIN public.waste_types w ON w.id = c.waste_type_id AND w.is_active
    WHERE c.organization_id = template_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'В выбранном шаблоне нет активных видов отходов.'; END IF;
    RETURN org_id;
EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Организация с таким кодом уже существует.';
END;
$$;

CREATE OR REPLACE FUNCTION public.w4_create_responsible(p_token uuid, p_fields jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
    profile_id uuid;
    org_id uuid := (p_fields->>'organization_id')::uuid;
    new_email text := lower(trim(p_fields->>'email'));
    new_password text := p_fields->>'password';
BEGIN
    PERFORM atu_private.w4_actor(p_token, ARRAY['admin']::public.user_role[]);
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = org_id AND is_active) THEN
        RAISE EXCEPTION 'Выберите действующую организацию.';
    END IF;
    IF coalesce(new_email, '') !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
        OR coalesce(trim(p_fields->>'full_name_ru'), '') = ''
        OR coalesce(char_length(new_password), 0) < 8 OR octet_length(new_password) > 72 THEN
        RAISE EXCEPTION 'Укажите ФИО, почту и пароль (от 8 символов, не более 72 байт).';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(new_email, 0));
    IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(trim(email)) = new_email) THEN
        RAISE EXCEPTION 'Пользователь с такой почтой уже существует.';
    END IF;
    INSERT INTO public.profiles (email, password_hash, full_name_ru, full_name_kz, role, organization_id)
    VALUES (new_email, crypt(new_password, gen_salt('bf', 10)), trim(p_fields->>'full_name_ru'),
            coalesce(nullif(trim(p_fields->>'full_name_kz'), ''), trim(p_fields->>'full_name_ru')),
            'responsible', org_id)
    RETURNING id INTO profile_id;
    RETURN profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION atu_private.w4_add_record(
    p_org uuid, p_date date, p_waste uuid, p_method uuid, p_amount numeric,
    p_actor uuid, p_import boolean
) RETURNS boolean
LANGUAGE plpgsql SET search_path = pg_catalog
AS $$
DECLARE report public.reports; waste_unit public.unit_type; month_start date;
BEGIN
    IF p_date IS NULL OR p_date < DATE '2000-01-01' OR p_date > current_date
        OR p_amount IS NULL OR p_amount <= 0 OR p_amount > 2000 OR round(p_amount, 2) <> p_amount THEN
        RAISE EXCEPTION 'Проверьте дату и количество (от 0,01 до 2000, не более двух знаков).';
    END IF;
    SELECT w.unit INTO waste_unit
    FROM public.waste_types w
    JOIN public.organization_waste_types c ON c.waste_type_id = w.id
    JOIN public.organizations o ON o.id = c.organization_id
    WHERE c.organization_id = p_org AND o.is_active AND w.id = p_waste AND w.is_active;
    IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.disposal_methods WHERE id = p_method AND is_active) THEN
        RAISE EXCEPTION 'Вид отходов или способ утилизации недоступен для этой точки.';
    END IF;

    month_start := date_trunc('month', p_date)::date;
    INSERT INTO public.reports (organization_id, period_month, period_start, period_end)
    VALUES (p_org, to_char(p_date, 'YYYY-MM'), month_start, (month_start + interval '1 month - 1 day')::date)
    ON CONFLICT (organization_id, period_month) DO NOTHING;
    SELECT * INTO report FROM public.reports
    WHERE organization_id = p_org AND period_month = to_char(p_date, 'YYYY-MM') FOR UPDATE;
    IF report.status NOT IN ('draft', 'returned') THEN
        RAISE EXCEPTION 'Отчёт за % уже отправлен или принят.', report.period_month;
    END IF;
    IF p_import AND EXISTS (
        SELECT 1 FROM public.waste_records
        WHERE report_id = report.id AND record_date = p_date AND waste_type_id = p_waste
          AND disposal_method_id = p_method AND amount = p_amount
    ) THEN RETURN false; END IF;
    INSERT INTO public.waste_records (report_id, organization_id, record_date, waste_type_id,
                                     amount, unit, disposal_method_id, responsible_id, comment)
    VALUES (report.id, p_org, p_date, p_waste, p_amount, waste_unit, p_method, p_actor,
            CASE WHEN p_import THEN 'Импорт из Excel' END);
    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.w4_import(p_token uuid, p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog SET timezone = 'Asia/Almaty'
AS $$
DECLARE actor public.profiles; entry record; saved integer := 0;
BEGIN
    actor := atu_private.w4_actor(p_token, ARRAY['admin','inspector']::public.user_role[]);
    IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 2000 THEN
        RAISE EXCEPTION 'Файл должен содержать от 1 до 2000 строк.';
    END IF;
    FOR entry IN
        SELECT * FROM jsonb_to_recordset(p_rows) AS r(
            line integer, organization_id uuid, date date, waste_id uuid, disposal_id uuid, amount numeric, unit public.unit_type
        ) ORDER BY organization_id, date, line
    LOOP
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM public.waste_types WHERE id = entry.waste_id AND unit = entry.unit) THEN
                RAISE EXCEPTION 'Единица измерения не совпадает со справочником.';
            END IF;
            IF atu_private.w4_add_record(entry.organization_id, entry.date, entry.waste_id,
                                        entry.disposal_id, entry.amount, actor.id, true) THEN
                saved := saved + 1;
            END IF;
        EXCEPTION WHEN raise_exception THEN
            RAISE EXCEPTION 'Строка %: %', entry.line, SQLERRM;
        END;
    END LOOP;
    RETURN saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.w4_point_add(
    p_token uuid, p_point text, p_date date, p_waste uuid, p_method uuid, p_amount numeric
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog SET timezone = 'Asia/Almaty'
AS $$
DECLARE actor public.profiles;
BEGIN
    actor := atu_private.w4_actor(p_token, ARRAY['responsible']::public.user_role[]);
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = actor.organization_id AND qr_code_token = p_point AND is_active) THEN
        RAISE EXCEPTION 'Ваш аккаунт не привязан к этой точке.' USING ERRCODE = '42501';
    END IF;
    PERFORM atu_private.w4_add_record(actor.organization_id, p_date, p_waste, p_method, p_amount, actor.id, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.w4_point_submit(p_token uuid, p_point text, p_month text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE actor public.profiles; report public.reports;
BEGIN
    actor := atu_private.w4_actor(p_token, ARRAY['responsible']::public.user_role[]);
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = actor.organization_id AND qr_code_token = p_point AND is_active) THEN
        RAISE EXCEPTION 'Ваш аккаунт не привязан к этой точке.' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO report FROM public.reports
    WHERE organization_id = actor.organization_id AND period_month = p_month FOR UPDATE;
    IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.waste_records WHERE report_id = report.id) THEN
        RAISE EXCEPTION 'Сначала добавьте хотя бы одну запись за этот месяц.';
    END IF;
    IF report.status NOT IN ('draft', 'returned') THEN RAISE EXCEPTION 'Отчёт уже отправлен или принят.'; END IF;
    UPDATE public.reports SET status = 'submitted', submitted_by = actor.id, submitted_at = now(),
        reviewed_at = NULL, reviewed_by = NULL, inspector_comment = NULL WHERE id = report.id;
END;
$$;

-- Keep read projections used by W1–W3, but never expose password hashes or
-- allow clients to bypass the admin procedures with direct table writes.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.organizations, public.profiles, public.organization_waste_types FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON public.profiles FROM PUBLIC, anon, authenticated;
REVOKE SELECT (password_hash) ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, auth_user_id, email, full_name_ru, full_name_kz, role, organization_id, is_active, created_at)
    ON public.profiles TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.w4_sign_in(text,text), public.w4_sign_out(uuid),
    public.w4_create_organization(uuid,jsonb), public.w4_create_responsible(uuid,jsonb), public.w4_import(uuid,jsonb),
    public.w4_point_add(uuid,text,date,uuid,uuid,numeric), public.w4_point_submit(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.w4_sign_in(text,text), public.w4_sign_out(uuid),
    public.w4_create_organization(uuid,jsonb), public.w4_create_responsible(uuid,jsonb), public.w4_import(uuid,jsonb),
    public.w4_point_add(uuid,text,date,uuid,uuid,numeric), public.w4_point_submit(uuid,text,text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
