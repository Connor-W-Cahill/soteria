import {
  CATEGORY_KEYS,
  CATEGORY_LABELS,
  questionsForCategory,
} from "@soteria/shared";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Button, Card, Select } from "../../components";
import { getQuestionnaire, putQuestionnaire } from "./api";
import "./questionnaire.css";

type LoadState = "loading" | "ready" | "error";

/**
 * Multi-step posture questionnaire (US-16): one category per step, a progress
 * indicator, and save-and-resume backed by `PUT /api/questionnaire`.
 *
 * Answers are only ever an option id. Nothing free-text is collected, so nothing
 * free-text can be sent or stored. The score itself is US-17 — this form saves
 * answers and stops there.
 */
export function QuestionnaireForm() {
  const steps = CATEGORY_KEYS;

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [load, setLoad] = useState<LoadState>("loading");
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorId = useId();

  useEffect(() => {
    let cancelled = false;
    getQuestionnaire()
      .then((state) => {
        if (cancelled) return;
        setAnswers(state.answers);
        setLoad("ready");
      })
      .catch(() => {
        if (!cancelled) setLoad("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Move focus to the step (or completion) heading whenever the view changes, so
  // a keyboard or screen-reader user is taken to the new content instead of
  // being left on a button that has moved.
  useEffect(() => {
    if (load === "ready") headingRef.current?.focus();
  }, [stepIndex, finished, load]);

  const category = steps[stepIndex]!;
  const questions = questionsForCategory(category);
  const stepComplete = questions.every((question) => answers[question.id]);

  const persist = useCallback(async (next: Record<string, string>) => {
    setSaving(true);
    setSaveError(null);
    try {
      const state = await putQuestionnaire(next);
      setAnswers(state.answers);
      return true;
    } catch {
      setSaveError(
        "Your answers could not be saved. Check your connection and try again.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const onNext = useCallback(async () => {
    setNote(null);
    if (!(await persist(answers))) return;
    if (stepIndex === steps.length - 1) {
      setFinished(true);
    } else {
      setStepIndex((index) => index + 1);
    }
  }, [answers, persist, stepIndex, steps.length]);

  const onBack = useCallback(() => {
    setNote(null);
    setSaveError(null);
    setStepIndex((index) => Math.max(0, index - 1));
  }, []);

  const onSaveForLater = useCallback(async () => {
    if (await persist(answers)) {
      setNote(
        "Progress saved. You can close this page and come back to it later.",
      );
    }
  }, [answers, persist]);

  if (load === "loading") {
    return <p className="sot-qz__status">Loading your questionnaire…</p>;
  }

  if (load === "error") {
    return (
      <p className="sot-qz__status" role="alert">
        We couldn&rsquo;t load your questionnaire. Please refresh to try again.
      </p>
    );
  }

  if (finished) {
    return (
      <Card className="sot-qz" title="Questionnaire saved">
        <h2 className="sot-qz__heading" tabIndex={-1} ref={headingRef}>
          Thanks — your answers are saved
        </h2>
        <p>
          Your posture score is calculated from these answers. That step is part
          of a later Soteria milestone, so you won&rsquo;t see a number yet.
        </p>
        <p>
          You can revisit this questionnaire any time to update your answers.
        </p>
        <div className="sot-qz__actions">
          <Button onClick={() => setFinished(false)} variant="secondary">
            Review my answers
          </Button>
          <Link className="sot-btn sot-btn--primary" to="/dashboard">
            Go to dashboard
          </Link>
        </div>
      </Card>
    );
  }

  const answeredSteps = steps.filter((key) =>
    questionsForCategory(key).every((question) => answers[question.id]),
  ).length;

  return (
    <Card className="sot-qz">
      <div
        className="sot-qz__progress"
        role="progressbar"
        aria-label="Questionnaire progress"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={answeredSteps}
        aria-valuetext={`${answeredSteps} of ${steps.length} sections complete`}
      >
        <span className="sot-qz__progress-label">
          Step {stepIndex + 1} of {steps.length}
        </span>
        <span className="sot-qz__progress-track" aria-hidden="true">
          <span
            className="sot-qz__progress-fill"
            style={{ width: `${(stepIndex / (steps.length - 1)) * 100}%` }}
          />
        </span>
      </div>

      <h2 className="sot-qz__heading" tabIndex={-1} ref={headingRef}>
        {CATEGORY_LABELS[category]}
      </h2>

      <div className="sot-qz__questions">
        {questions.map((question) => (
          <Select
            key={question.id}
            label={question.prompt}
            hint={question.helpText}
            value={answers[question.id] ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              setNote(null);
              setAnswers((prev) => {
                if (value === "") {
                  const rest = { ...prev };
                  delete rest[question.id];
                  return rest;
                }
                return { ...prev, [question.id]: value };
              });
            }}
          >
            <option value="">Select an answer…</option>
            {question.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        ))}
      </div>

      {saveError ? (
        <p className="sot-qz__error" id={errorId} role="alert">
          {saveError}
        </p>
      ) : null}
      {note ? (
        <p className="sot-qz__note" role="status">
          {note}
        </p>
      ) : null}

      <div className="sot-qz__actions">
        <Button
          variant="secondary"
          onClick={onBack}
          disabled={stepIndex === 0 || saving}
        >
          Back
        </Button>
        <Button variant="ghost" onClick={onSaveForLater} disabled={saving}>
          Save &amp; finish later
        </Button>
        <Button
          onClick={onNext}
          disabled={!stepComplete || saving}
          aria-describedby={saveError ? errorId : undefined}
        >
          {stepIndex === steps.length - 1 ? "Save answers" : "Next"}
        </Button>
      </div>
    </Card>
  );
}

export default QuestionnaireForm;
