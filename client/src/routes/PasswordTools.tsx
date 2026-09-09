import { BreachChecker } from "../features/password/BreachChecker";
import { PasswordGenerator } from "../features/password/PasswordGenerator";
import { PassphraseGenerator } from "../features/password/PassphraseGenerator";

/**
 * `/password-tools`. The breach checker (US-01) and the random password
 * generator (US-02) render here as separate sections; the passphrase generator
 * (US-03) is added alongside them.
 */
export default function PasswordTools() {
  return (
    <div className="pw-page">
      <h1>Password tools</h1>
      <p className="pw-page__lede">
        These tools run in your browser. Nothing you type or generate here is
        sent to Soteria, stored, or logged.
      </p>
      <BreachChecker />
      <PasswordGenerator />
      <PassphraseGenerator />
    </div>
  );
}
