import { useCallback, useState } from "react";

import { Button, Card, Dialog, Input } from "../components";
import { useSession } from "../session";

/** The word the user has to type before the delete button unlocks. */
export const CONFIRM_WORD = "DELETE";

/**
 * Exactly what a delete removes, in the user's terms. Shown in the dialog and
 * asserted by `Settings.test.ts` so the copy cannot drift from a promise.
 */
export const DELETED_DATA = [
  "your questionnaire answers and score history",
  "your password-manager coach progress",
  "your software list and its CVE matches and alerts",
  "your recommendations and notification settings",
  "your Google sign-in link and the account itself",
];

export function isConfirmed(typed: string): boolean {
  return typed === CONFIRM_WORD;
}

/**
 * `/settings`, behind `RequireSession`. The only thing it does today is US-20:
 * delete the account and everything it owns.
 */
export default function Settings() {
  const { user, deleteAccount } = useSession();

  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setTyped("");
    setError(null);
  }, []);

  const onConfirm = useCallback(() => {
    if (!isConfirmed(typed)) return;

    setBusy(true);
    setError(null);

    deleteAccount()
      .then(() => {
        // A full navigation, not a client-side one: the account and every scrap
        // of its in-memory state should be gone, and `/password-tools` is the
        // anonymous landing page. A SPA transition here also races the
        // RequireSession guard, which now sees an anonymous session.
        window.location.assign("/password-tools");
      })
      .catch(() => {
        setBusy(false);
        setError("Your account could not be deleted. Please try again.");
      });
  }, [typed, deleteAccount]);

  return (
    <div className="settings">
      <h1>Settings</h1>

      <Card title="Delete account">
        <p className="settings__lede">
          {user?.email ? `Signed in as ${user.email}. ` : null}
          Deleting your account permanently removes everything Soteria has
          stored for you. This cannot be undone.
        </p>
        <Button
          variant="secondary"
          onClick={() => setOpen(true)}
          className="settings__danger"
        >
          Delete account and all data
        </Button>
      </Card>

      <Dialog
        open={open}
        onClose={close}
        title="Delete your account?"
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              className="settings__danger"
              onClick={onConfirm}
              disabled={busy || !isConfirmed(typed)}
            >
              {busy ? "Deleting…" : "Delete account"}
            </Button>
          </>
        }
      >
        <p>This permanently deletes:</p>
        <ul className="settings__list">
          {DELETED_DATA.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>
          It does <strong>not</strong> cancel any Have I Been Pwned breach
          notifications you signed up for. Soteria never enrolled you — you gave
          your address to HIBP directly — so you must cancel it there:{" "}
          <a
            href="https://haveibeenpwned.com/OptOut"
            target="_blank"
            rel="noreferrer"
          >
            haveibeenpwned.com/OptOut
          </a>
          .
        </p>

        <Input
          label={`Type ${CONFIRM_WORD} to confirm`}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {error ? (
          <p className="settings__error" role="alert">
            {error}
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}
