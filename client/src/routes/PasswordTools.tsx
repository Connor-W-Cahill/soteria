import { BreachChecker } from "../features/password/BreachChecker";

/**
 * `/password-tools`. The breach checker (US-01) lands here; the generators
 * (US-02, US-03) are added alongside it as separate sections.
 */
export default function PasswordTools() {
  return (
    <div className="pw-page">
      <h1>Password tools</h1>
      <p className="pw-page__lede">
        These tools run in your browser. Nothing you type here is sent to
        Soteria, stored, or logged.
      </p>
      <BreachChecker />
    </div>
  );
}
