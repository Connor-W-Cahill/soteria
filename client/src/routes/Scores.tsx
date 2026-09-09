import {
  CATEGORY_LABELS,
  type CategoryScore,
  type ScoresResponse,
} from "@soteria/shared";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Button, Card, EmptyState, SparklineCard } from "../components";
import { useScoreHistory } from "../features/scores/history";

/**
 * `/scores` — the five category scores and the overall score (US-17).
 *
 * The explanations behind each number are US-18's job; this page shows the
 * scores, says how many questions each came from, and flags anything provisional.
 * It deliberately does not invent a number where there is none: a category with
 * no answers renders an em dash, not a zero.
 *
 * The sparklines are fed from `GET /api/scores/history` (US-19). A category with
 * fewer than two snapshots still renders as an empty chart rather than a
 * fabricated trend — `SparklineCard` draws nothing below two points — and a
 * history request that fails is non-fatal: the scores still show.
 */
const API_BASE = import.meta.env.VITE_API_URL ?? "";

function scoreLabel(category: CategoryScore): string {
  return category.score === null ? "—" : `${category.score}`;
}

function whyFor(category: CategoryScore): string {
  if (category.score === null) {
    return `Not answered yet — ${category.total} question${category.total === 1 ? "" : "s"} to go`;
  }

  const counted = `${category.answered} of ${category.total} answered`;

  return category.provisional ? `${counted} · provisional` : counted;
}

export default function Scores() {
  const [scores, setScores] = useState<ScoresResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: history } = useScoreHistory(90);

  const historyByCategory = new Map(
    (history?.categories ?? []).map((series) => [
      series.key,
      series.points.map((point) => point.score),
    ]),
  );

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/scores`, { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<ScoresResponse>;
      })
      .then(setScores)
      .catch(() => setError("Your scores could not be loaded right now."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  if (loading) {
    return (
      <div className="scores">
        <h1>Your posture score</h1>
        <p role="status">Loading your scores…</p>
      </div>
    );
  }

  if (error !== null) {
    return (
      <div className="scores">
        <h1>Your posture score</h1>
        <p className="scores__error" role="alert">
          {error}
        </p>
        <Button variant="secondary" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }

  if (scores === null || scores.overall === null) {
    return (
      <div className="scores">
        <h1>Your posture score</h1>
        <EmptyState
          title="No score yet"
          body="Answer the posture questionnaire and your five category scores will appear here. You can stop and resume at any point."
          action={<Link to="/questionnaire">Start the questionnaire</Link>}
        />
      </div>
    );
  }

  return (
    <div className="scores">
      <h1>Your posture score</h1>

      <Card title="Overall">
        <p className="scores__overall">
          <span className="scores__overall-value">{scores.overall}</span>
          <span className="scores__overall-of"> out of 100</span>
        </p>
        <p className="scores__lede">
          Scored from the questions you have answered, not from all of them, so
          an unfinished questionnaire is not counted against you.{" "}
          <Link to="/questionnaire">Answer more questions</Link> to sharpen it.
        </p>
        {scores.provisional ? (
          <p className="scores__note" role="note">
            One category is provisional: it will also account for known
            vulnerabilities in the software you list once that check is part of
            the product.
          </p>
        ) : null}
      </Card>

      <h2>By category</h2>
      <div className="scores__grid">
        {scores.categories.map((category) => (
          <SparklineCard
            key={category.key}
            name={CATEGORY_LABELS[category.key]}
            value={scoreLabel(category)}
            why={whyFor(category)}
            history={historyByCategory.get(category.key) ?? []}
          />
        ))}
      </div>

      <p className="scores__asof">
        <Link to="/progress">See how your score has changed over time</Link>
      </p>

      {scores.updatedAt === null ? null : (
        <p className="scores__asof">
          Based on your answers saved on{" "}
          {new Date(scores.updatedAt).toLocaleDateString()}.
        </p>
      )}
    </div>
  );
}
