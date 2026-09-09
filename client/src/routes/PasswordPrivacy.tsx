import { Link } from "react-router-dom";

import { PrivacyExplainer } from "../features/password/PrivacyExplainer";

/**
 * `/learn/password-privacy` (US-05). The full version of the explanation shown
 * in the "How this works" disclosure above the breach checker. Both render the
 * same `PrivacyExplainer`, so the two can never drift apart.
 */
export default function PasswordPrivacy() {
  return (
    <div className="pw-privacy">
      <h1>How the password breach check protects your privacy</h1>
      <p className="pw-privacy__lede">
        You can check a password against known data breaches without Soteria, or
        anyone else, learning what it is. Here is exactly what happens and what
        each party can see.
      </p>
      <PrivacyExplainer />
      <p className="pw-privacy__back">
        <Link to="/password-tools">Back to the password tools</Link>
      </p>
    </div>
  );
}
