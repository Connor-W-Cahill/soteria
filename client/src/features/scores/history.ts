import type { ScoreHistoryResponse } from "@soteria/shared";
import { useCallback, useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

/** Windows the `/progress` range control offers. All within the API's bound. */
export const HISTORY_RANGES = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
] as const;

export async function fetchScoreHistory(
  days: number,
): Promise<ScoreHistoryResponse> {
  const response = await fetch(`${API_BASE}/api/scores/history?days=${days}`, {
    credentials: "include",
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  return (await response.json()) as ScoreHistoryResponse;
}

interface HistoryState {
  data: ScoreHistoryResponse | null;
  error: boolean;
  loading: boolean;
  reload: () => void;
}

/**
 * Loads score history for a window. Failure is non-fatal for the caller: the
 * sparklines and the trend simply do not draw, which is already how
 * `SparklineCard` handles too few points.
 */
export function useScoreHistory(days: number): HistoryState {
  const [data, setData] = useState<ScoreHistoryResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetchScoreHistory(days)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [days]);

  useEffect(reload, [reload]);

  return { data, error, loading, reload };
}
