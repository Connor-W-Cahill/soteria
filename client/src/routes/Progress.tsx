import {
  CATEGORY_LABELS,
  type CategoryKey,
  type ScoreHistoryResponse,
  type ScoreHistorySeries,
} from "@soteria/shared";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button, EmptyState, Select } from "../components";
import { HISTORY_RANGES, useScoreHistory } from "../features/scores/history";

/**
 * `/progress` — how the posture score has moved over time (US-19).
 *
 * Two representations of the same rows, and the toggle between them is not a
 * nicety: the per-category line charts are inline SVG and carry `aria-hidden`,
 * so for a screen-reader user the data table IS the content. The change log
 * below reads the same history a third way, in words.
 *
 * The trend is drawn only from real `score_snapshots` rows. Nothing here
 * invents a point: a category with fewer than two snapshots shows a single
 * marker or "Not enough history yet", never a fabricated line.
 */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** One small-multiple line chart for a single category. Decorative (see file doc). */
function CategoryTrend({ series }: { series: ScoreHistorySeries }) {
  const w = 320;
  const h = 96;
  const pad = 6;

  if (series.points.length === 0) {
    return <p className="progress__empty-note">Not enough history yet.</p>;
  }

  const times = series.points.map((p) => new Date(p.capturedAt).getTime());
  const tMin = Math.min(...times);
  const tSpan = Math.max(...times) - tMin || 1;

  const x = (t: number) => pad + ((t - tMin) / tSpan) * (w - pad * 2);
  const y = (score: number) => h - pad - (score / 100) * (h - pad * 2);

  const coords = series.points.map(
    (p, i) => [x(times[i]!), y(p.score)] as const,
  );
  const d = coords
    .map(
      ([px, py], i) =>
        `${i === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`,
    )
    .join(" ");

  return (
    <svg
      className="progress__spark"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <line
        className="progress__axis"
        x1={pad}
        y1={h - pad}
        x2={w - pad}
        y2={h - pad}
        strokeWidth="1"
      />
      {series.points.length > 1 ? (
        <path
          className="progress__line"
          d={d}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {coords.map(([px, py], i) => (
        <circle key={i} className="progress__dot" cx={px} cy={py} r="2.5" />
      ))}
    </svg>
  );
}

/** Distinct capture timestamps across every category, oldest first. */
function allTimestamps(data: ScoreHistoryResponse): string[] {
  const set = new Set<string>();
  for (const series of data.categories) {
    for (const point of series.points) set.add(point.capturedAt);
  }
  return [...set].sort();
}

function scoreAt(
  series: ScoreHistorySeries,
  capturedAt: string,
): number | null {
  return series.points.find((p) => p.capturedAt === capturedAt)?.score ?? null;
}

function HistoryTable({ data }: { data: ScoreHistoryResponse }) {
  const timestamps = allTimestamps(data);

  return (
    <div
      className="progress__table-scroll"
      role="region"
      aria-label="Posture score history table"
      tabIndex={0}
    >
      <table className="progress__table">
        <caption>Posture score history, by category and date</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {data.categories.map((series) => (
              <th scope="col" key={series.key}>
                {CATEGORY_LABELS[series.key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timestamps.length === 0 ? (
            <tr>
              <td colSpan={data.categories.length + 1}>No snapshots yet.</td>
            </tr>
          ) : (
            timestamps.map((capturedAt) => (
              <tr key={capturedAt}>
                <th scope="row">{formatDate(capturedAt)}</th>
                {data.categories.map((series) => {
                  const value = scoreAt(series, capturedAt);
                  return (
                    <td key={series.key}>{value === null ? "—" : value}</td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ChangeLog({ data }: { data: ScoreHistoryResponse }) {
  if (data.changes.length === 0) {
    return (
      <p className="progress__empty-note">
        No changes recorded yet. Answer more of the questionnaire and your
        movements will be listed here.
      </p>
    );
  }

  return (
    <ol className="progress__changelog">
      {data.changes.map((change) => (
        <li key={change.capturedAt} className="progress__change">
          <p className="progress__change-date">
            {formatDate(change.capturedAt)}
          </p>
          <ul className="progress__change-deltas">
            {change.deltas.map((delta) => (
              <li key={delta.key}>
                {CATEGORY_LABELS[delta.key as CategoryKey]}: {delta.from} →{" "}
                {delta.to}{" "}
                <span className="progress__delta">
                  ({delta.delta > 0 ? "+" : delta.delta < 0 ? "−" : ""}
                  {Math.abs(delta.delta)}{" "}
                  {delta.delta > 0 ? "improvement" : "decline"})
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export default function Progress() {
  const [days, setDays] = useState<number>(90);
  const [showTable, setShowTable] = useState(false);
  const { data, error, loading, reload } = useScoreHistory(days);

  const hasAnyPoint = useMemo(
    () => data?.categories.some((series) => series.points.length > 0) ?? false,
    [data],
  );

  return (
    <div className="progress">
      <h1>Your progress</h1>
      <p className="progress__lede">
        How your five category scores have moved, from the snapshots taken each
        time you saved the <Link to="/questionnaire">questionnaire</Link>. See
        the current numbers on <Link to="/scores">your posture score</Link>.
      </p>

      <div className="progress__controls">
        <Select
          label="Time range"
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
        >
          {HISTORY_RANGES.map((range) => (
            <option key={range.days} value={range.days}>
              {range.label}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <p role="status">Loading your history…</p>
      ) : error ? (
        <>
          <p className="progress__error" role="alert">
            Your history could not be loaded right now.
          </p>
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        </>
      ) : data === null || !hasAnyPoint ? (
        <EmptyState
          title="No history yet"
          body="A snapshot is recorded the first time you save the questionnaire, and at most once an hour after that. Save some answers and your trend will build up here."
          action={<Link to="/questionnaire">Go to the questionnaire</Link>}
        />
      ) : (
        <>
          <section aria-labelledby="progress-trend-heading">
            <div className="progress__section-head">
              <h2 id="progress-trend-heading">Trend</h2>
              <Button
                variant="secondary"
                aria-pressed={showTable}
                onClick={() => setShowTable((value) => !value)}
              >
                {showTable ? "Show charts" : "Show as table"}
              </Button>
            </div>

            <div
              className="progress__charts"
              aria-hidden="true"
              hidden={showTable}
            >
              {data.categories.map((series) => (
                <div key={series.key} className="progress__chart-card">
                  <p className="progress__chart-title">
                    {CATEGORY_LABELS[series.key]}
                  </p>
                  <CategoryTrend series={series} />
                </div>
              ))}
            </div>

            <div hidden={!showTable}>
              <HistoryTable data={data} />
            </div>
          </section>

          <section aria-labelledby="progress-changelog-heading">
            <h2 id="progress-changelog-heading">Change log</h2>
            <ChangeLog data={data} />
          </section>
        </>
      )}
    </div>
  );
}
