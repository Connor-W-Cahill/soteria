import { QuestionnaireForm } from "../features/questionnaire/QuestionnaireForm";

/**
 * `/questionnaire` (US-16). Account-only: mounted behind `RequireSession` in
 * `App.tsx`, and the API it calls is behind `requireSession()`.
 */
export default function Questionnaire() {
  return (
    <div className="sot-qz-page">
      <h1>Posture questionnaire</h1>
      <p className="sot-qz-page__lede">
        A few questions about your security habits, grouped into five areas.
        Your answers are saved as you go, so you can stop and come back. We only
        store the options you pick.
      </p>
      <QuestionnaireForm />
    </div>
  );
}
