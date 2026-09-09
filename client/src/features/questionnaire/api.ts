import type { QuestionnaireState } from "@soteria/shared";

/**
 * Thin client for `/api/questionnaire` (US-16).
 *
 * `credentials: "include"` so the session cookie rides along — the routes are
 * behind `requireSession()`. Only the chosen option ids are ever sent; the form
 * collects nothing free-text.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });

  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${path} failed: ${response.status}`,
    );
  }

  return (await response.json()) as T;
}

export function getQuestionnaire(): Promise<QuestionnaireState> {
  return json<QuestionnaireState>("/api/questionnaire");
}

export function putQuestionnaire(
  answers: Record<string, string>,
): Promise<QuestionnaireState> {
  return json<QuestionnaireState>("/api/questionnaire", {
    method: "PUT",
    body: JSON.stringify({ answers }),
  });
}
