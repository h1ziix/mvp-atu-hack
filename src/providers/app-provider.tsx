import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import * as repository from "@/lib/repository";
import { readJSON, sessionStorage, writeJSON } from "@/lib/storage";
import { clearSmartSession, startSmartSession } from "@/lib/smart-input";
import { sessionScope, supabase } from "@/lib/supabase";
import type {
  Draft,
  Language,
  NewWasteType,
  User,
  Workspace,
} from "@/lib/types";

type AppContextValue = {
  user: User | null;
  language: Language;
  hydrated: boolean;
  workspace: Workspace | null;
  month: string;
  loading: boolean;
  busy: boolean;
  error: string | null;
  offline: boolean;
  setLanguage: (value: Language) => void;
  setMonth: (value: string) => void;
  t: (ru: string, kz: string) => string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  save: (draft: Draft, id?: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addWaste: (input: NewWasteType) => Promise<string>;
  submit: () => Promise<void>;
  demoReview: (status: "returned" | "approved") => Promise<void>;
};
const AppContext = createContext<AppContextValue | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [language, setLanguageValue] = useState<Language>("ru");
  const [hydrated, setHydrated] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [month, setMonthValue] = useState("2026-11");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const requestId = useRef(0);
  const mutation = useRef(false);
  const workspaceRef = useRef(workspace);
  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);
  useEffect(() => {
    Promise.all([
      sessionStorage().catch(() => null),
      readJSON<Language>("language").catch(() => null),
    ])
      .then(([session, lang]) => {
        if (session) {
          try {
            const saved = JSON.parse(session as string) as {
              user?: User;
              scope?: string;
            };
            if (
              saved.scope === sessionScope &&
              saved.user?.role === "responsible"
            )
              setUser(saved.user);
            else void sessionStorage(null).catch(() => setError("storage"));
          } catch {
            void sessionStorage(null).catch(() => {});
          }
        }
        if (lang) setLanguageValue(lang);
      })
      .finally(() => setHydrated(true));
  }, []);
  const setLanguage = useCallback((value: Language) => {
    setLanguageValue(value);
    void writeJSON("language", value).catch(() => setError("storage"));
  }, []);
  const refresh = useCallback(async () => {
    if (!user || mutation.current) return;
    const request = ++requestId.current;
    setLoading(true);
    try {
      const next = await repository.loadWorkspace(user, month);
      if (request !== requestId.current) return;
      setWorkspace(next);
      setOffline(false);
      setError(null);
      void repository
        .cacheWorkspace(user, next)
        .catch(() => setError("storage"));
    } catch {
      if (request !== requestId.current) return;
      setOffline(true);
      setError("network");
      if (!workspaceRef.current) {
        const cached = await readJSON<Workspace>(
          repository.workspaceKey(user, month),
        ).catch(() => null);
        if (request === requestId.current && cached) setWorkspace(cached);
      }
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [user, month]);
  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);
  useEffect(() => {
    if (!user) return;
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    if (!supabase || !workspace?.report.id) return () => listener.remove();
    let timer: ReturnType<typeof setTimeout>;
    const channel = supabase.channel(`mobile-${workspace.report.id}`);
    for (const table of ["reports", "waste_records", "status_history"]) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `${table === "reports" ? "id" : "report_id"}=eq.${workspace.report.id}`,
        },
        () => {
          clearTimeout(timer);
          timer = setTimeout(() => void refresh(), 180);
        },
      );
    }
    channel.subscribe();
    return () => {
      listener.remove();
      clearTimeout(timer);
      void supabase?.removeChannel(channel);
    };
  }, [user, workspace?.report.id, refresh]);
  async function login(email: string, password: string) {
    const next = await repository.authenticate(email, password);
    await clearSmartSession().catch(() => {});
    // Failure of the optional AI service must not block the core waste workflow.
    await startSmartSession(next, email, password).catch(() => {});
    await sessionStorage(JSON.stringify({ user: next, scope: sessionScope }));
    requestId.current++;
    setMonthValue("2026-11");
    setWorkspace(null);
    setError(null);
    setUser(next);
  }
  async function logout() {
    await sessionStorage(null);
    await clearSmartSession().catch(() => {});
    requestId.current++;
    setUser(null);
    setWorkspace(null);
    setError(null);
    setOffline(false);
  }
  function setMonth(value: string) {
    if (mutation.current || value === month) return;
    requestId.current++;
    setWorkspace(null);
    setError(null);
    setOffline(false);
    setMonthValue(value);
  }
  async function mutate<T>(
    action: (current: Workspace) => Promise<{ next: Workspace; result: T }>,
  ): Promise<T> {
    if (!user || !workspace || mutation.current) throw new Error("busy");
    if (offline && supabase) throw new Error("network");
    mutation.current = true;
    setBusy(true);
    requestId.current++;
    try {
      const { next, result } = await action(workspace);
      // Local demo commits only after persistence succeeds; remote writes are already committed.
      if (!supabase) await repository.cacheWorkspace(user, next);
      setWorkspace(next);
      setError(null);
      if (supabase)
        void repository
          .cacheWorkspace(user, next)
          .catch(() => setError("storage"));
      return result;
    } finally {
      mutation.current = false;
      setBusy(false);
      setLoading(false);
    }
  }
  async function save(draft: Draft, id?: string) {
    await mutate(async (current) => {
      const record = await repository.saveRecord(user!, current, draft, id);
      return {
        next: {
          ...current,
          records: [
            ...current.records.filter((r) => r.id !== record.id),
            record,
          ],
        },
        result: undefined,
      };
    });
  }
  async function remove(id: string) {
    await mutate(async (current) => {
      await repository.deleteRecord(current, id);
      return {
        next: {
          ...current,
          records: current.records.filter((r) => r.id !== id),
        },
        result: undefined,
      };
    });
  }
  async function addWaste(input: NewWasteType) {
    return mutate(async (current) => {
      const item = await repository.addWasteType(user!, input, current);
      return {
        next: {
          ...current,
          catalog: [
            ...current.catalog.filter(
              (c) => c.waste_type_id !== item.waste_type_id,
            ),
            item,
          ],
        },
        result: item.waste_type_id,
      };
    });
  }
  async function submit() {
    await mutate(async (current) => {
      const report = await repository.submitReport(user!, current);
      return {
        next: {
          ...current,
          report,
          history: [
            ...current.history,
            {
              id: `submitted-${Date.now()}`,
              report_id: report.id,
              from_status: current.report.status,
              to_status: report.status,
              comment: null,
              created_at: report.submitted_at!,
            },
          ],
        },
        result: undefined,
      };
    });
    if (supabase) void refresh();
  }
  async function demoReview(status: "returned" | "approved") {
    if (supabase) return;
    await mutate(async (current) => {
      if (!["submitted", "in_review"].includes(current.report.status))
        throw new Error("locked");
      const now = new Date().toISOString();
      const comment =
        status === "returned"
          ? "Проверьте массу последнего взвешивания и приложите фото. После исправления отправьте отчёт повторно."
          : null;
      return {
        next: {
          ...current,
          report: {
            ...current.report,
            status,
            inspector_comment: comment,
            reviewed_at: now,
          },
          history: [
            ...current.history,
            {
              id: `review-${Date.now()}`,
              report_id: current.report.id,
              from_status: current.report.status,
              to_status: status,
              comment,
              created_at: now,
            },
          ],
        },
        result: undefined,
      };
    });
  }
  return (
    <AppContext
      value={{
        user,
        language,
        hydrated,
        workspace,
        month,
        loading,
        busy,
        error,
        offline,
        setLanguage,
        setMonth,
        t: (ru, kz) => (language === "ru" ? ru : kz),
        login,
        logout,
        refresh,
        save,
        remove,
        addWaste,
        submit,
        demoReview,
      }}
    >
      {children}
    </AppContext>
  );
}
export function useApp() {
  const value = use(AppContext);
  if (!value) throw new Error("AppProvider is missing");
  return value;
}
