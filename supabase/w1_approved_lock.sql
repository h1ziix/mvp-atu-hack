-- Run after the shared supabase_schema_and_seed.sql.
BEGIN;

CREATE OR REPLACE FUNCTION public.guard_approved_report()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF OLD.status = 'approved' THEN
        RAISE EXCEPTION 'Принятый отчёт заблокирован от редактирования (ФТ-3.4).';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_approved_report ON public.reports;
CREATE TRIGGER trg_guard_approved_report
BEFORE UPDATE OR DELETE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.guard_approved_report();

CREATE OR REPLACE FUNCTION public.guard_approved_report_records()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    source_report uuid;
    target_report uuid;
    parent_status public.report_status;
BEGIN
    IF TG_OP <> 'INSERT' THEN source_report := OLD.report_id; END IF;
    IF TG_OP <> 'DELETE' THEN target_report := NEW.report_id; END IF;

    -- Inspect both parents when moving a row and serialize with report approval.
    FOR parent_status IN
        SELECT status FROM public.reports
        WHERE id IN (source_report, target_report)
        ORDER BY id FOR SHARE
    LOOP
        IF parent_status = 'approved' THEN
            RAISE EXCEPTION 'Записи принятого отчёта заблокированы (ФТ-3.4).';
        END IF;
    END LOOP;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_approved_report_records ON public.waste_records;
CREATE TRIGGER trg_guard_approved_report_records
BEFORE INSERT OR UPDATE OR DELETE ON public.waste_records
FOR EACH ROW EXECUTE FUNCTION public.guard_approved_report_records();

COMMIT;
