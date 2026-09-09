/**
 * Posture questionnaire question set (US-16).
 *
 * This is a **plain data module**: no I/O, no Node built-ins, no dependencies.
 * `@soteria/shared` is imported by the browser bundle, and `browser-safety.test.ts`
 * walks the import graph from the barrel and fails the build if anything reachable
 * from it touches `fs`, `path`, `process`, etc. (a `readFileSync` behind the
 * barrel once blanked the whole app — see #69). Keep it that way.
 *
 * The scoring engine (US-17, `shared/src/scoring/engine.ts`) consumes this set:
 * each answered option contributes its `weight` toward its question's category
 * sub-score. That is why the weights live in the question definition and not in
 * the engine — the issue requires it, and it keeps "what a good answer looks
 * like" next to the question a human reads.
 *
 * Privacy: an answer is only ever the id of a chosen option. Nothing free-text
 * is asked, so nothing free-text can be stored.
 */

/** The five posture categories, in the fixed order the score UI renders them. */
export type CategoryKey =
  | "password_hygiene"
  | "breach_preparedness"
  | "multifactor_authentication"
  | "software_exposure"
  | "update_habits";

/** Every category key, in canonical order. */
export const CATEGORY_KEYS: readonly CategoryKey[] = [
  "password_hygiene",
  "breach_preparedness",
  "multifactor_authentication",
  "software_exposure",
  "update_habits",
] as const;

/** Human-readable heading for each category, used by the form's step labels. */
export const CATEGORY_LABELS: Readonly<Record<CategoryKey, string>> = {
  password_hygiene: "Password habits",
  breach_preparedness: "Breach preparedness",
  multifactor_authentication: "Multi-factor authentication",
  software_exposure: "Software exposure",
  update_habits: "Update habits",
};

/** Inclusive bounds every option weight must fall within. */
export const MIN_OPTION_WEIGHT = 0;
export const MAX_OPTION_WEIGHT = 4;

export interface AnswerOption {
  /** Stable id, unique within its question. Stored verbatim as the answer. */
  id: string;
  label: string;
  /**
   * Points this option contributes toward its question's category before the
   * engine's per-category weighting. Integer in
   * [{@link MIN_OPTION_WEIGHT}, {@link MAX_OPTION_WEIGHT}]; higher is a better
   * habit. Every question offers exactly one option at {@link MAX_OPTION_WEIGHT}
   * so a category's best-possible sub-score is well defined.
   */
  weight: number;
}

export interface Question {
  /** Stable id, unique across the whole set. Stored as `question_key`. */
  id: string;
  category: CategoryKey;
  prompt: string;
  /** One or two sentences shown under the prompt to remove ambiguity. */
  helpText: string;
  options: AnswerOption[];
}

/**
 * Version stamp saved alongside a submission. Bump it whenever a question id,
 * an option id, or a weight changes so a stored submission can be read back
 * against the set it was answered under (US-19 history).
 */
export const QUESTIONNAIRE_VERSION = "1.0.0";

export const QUESTIONS: readonly Question[] = [
  // ---- password_hygiene ----
  {
    id: "pw_reuse",
    category: "password_hygiene",
    prompt:
      "How often do you reuse the same password across different accounts?",
    helpText:
      "Reusing a password means one leaked site exposes every account that shares it. A password manager makes unique passwords practical.",
    options: [
      {
        id: "many",
        label: "The same few passwords almost everywhere",
        weight: 0,
      },
      {
        id: "some",
        label: "A handful of accounts share a password",
        weight: 1,
      },
      {
        id: "important_unique",
        label: "Important accounts are unique, minor ones repeat",
        weight: 3,
      },
      {
        id: "all_unique",
        label: "Every account has its own password",
        weight: 4,
      },
    ],
  },
  {
    id: "pw_manager",
    category: "password_hygiene",
    prompt: "Do you use a password manager?",
    helpText:
      "A password manager generates and stores long random passwords so you only have to remember one strong passphrase.",
    options: [
      {
        id: "none",
        label: "No, I remember them or write them down",
        weight: 0,
      },
      { id: "browser", label: "Only my browser's built-in saving", weight: 2 },
      {
        id: "dedicated_some",
        label: "A dedicated manager for some accounts",
        weight: 3,
      },
      {
        id: "dedicated_all",
        label: "A dedicated manager for nearly everything",
        weight: 4,
      },
    ],
  },
  {
    id: "pw_length",
    category: "password_hygiene",
    prompt:
      "When you create a new password yourself, how long is it typically?",
    helpText:
      "Length matters far more than symbols. Aim for a passphrase of four or more random words, or 16+ characters.",
    options: [
      { id: "short", label: "Around 8 characters", weight: 0 },
      { id: "medium", label: "10 to 12 characters", weight: 2 },
      {
        id: "long",
        label: "16 or more characters, or a multi-word passphrase",
        weight: 4,
      },
    ],
  },
  // ---- breach_preparedness ----
  {
    id: "breach_check",
    category: "breach_preparedness",
    prompt:
      "Have you ever checked whether your email address appears in a known data breach?",
    helpText:
      "Services like Have I Been Pwned tell you which breaches included your address so you know which passwords to change.",
    options: [
      {
        id: "never",
        label: "Never, or I did not know that was possible",
        weight: 0,
      },
      { id: "once", label: "Once, a while ago", weight: 2 },
      {
        id: "monitoring",
        label: "Yes, and I get alerts for new breaches",
        weight: 4,
      },
    ],
  },
  {
    id: "breach_response",
    category: "breach_preparedness",
    prompt:
      "When you hear that a service you use has been breached, what do you do?",
    helpText:
      "The useful response is to change that password and any account that reused it, and to turn on multi-factor authentication if it is offered.",
    options: [
      { id: "nothing", label: "Usually nothing", weight: 0 },
      {
        id: "sometimes",
        label: "Change the password if I remember to",
        weight: 2,
      },
      {
        id: "always",
        label: "Change it and any account that shared it, promptly",
        weight: 4,
      },
    ],
  },
  {
    id: "breach_unique_email",
    category: "breach_preparedness",
    prompt:
      "Do you use email aliases or separate addresses for higher-risk sign-ups?",
    helpText:
      "A separate alias per site limits how breaches link your accounts together and makes spam easy to cut off.",
    options: [
      { id: "one", label: "One address for everything", weight: 1 },
      {
        id: "two",
        label: "A 'junk' address for low-trust sign-ups",
        weight: 3,
      },
      {
        id: "aliases",
        label: "Per-site aliases or plus-addressing routinely",
        weight: 4,
      },
    ],
  },
  // ---- multifactor_authentication ----
  {
    id: "mfa_email",
    category: "multifactor_authentication",
    prompt:
      "Is multi-factor authentication turned on for your primary email account?",
    helpText:
      "Your email can reset most of your other passwords, so it is the account that most needs a second factor.",
    options: [
      { id: "off", label: "No", weight: 0 },
      { id: "sms", label: "Yes, via a text-message code", weight: 2 },
      {
        id: "app_or_key",
        label: "Yes, via an authenticator app or security key",
        weight: 4,
      },
    ],
  },
  {
    id: "mfa_financial",
    category: "multifactor_authentication",
    prompt:
      "Is multi-factor authentication turned on for your bank and other financial accounts?",
    helpText:
      "Financial accounts are a direct target. Most banks now support an authenticator app or a code from their own app.",
    options: [
      { id: "off", label: "No, or not available", weight: 0 },
      { id: "some", label: "On some of them", weight: 2 },
      { id: "all", label: "On all of them", weight: 4 },
    ],
  },
  {
    id: "mfa_method",
    category: "multifactor_authentication",
    prompt: "What second factor do you rely on most?",
    helpText:
      "Authenticator apps and hardware security keys resist SIM-swapping and phishing far better than SMS codes.",
    options: [
      { id: "none", label: "I do not use a second factor", weight: 0 },
      { id: "sms", label: "SMS text codes", weight: 2 },
      {
        id: "app",
        label: "An authenticator app (TOTP) or push approval",
        weight: 3,
      },
      { id: "key", label: "A hardware security key or passkey", weight: 4 },
    ],
  },
  // ---- software_exposure ----
  {
    id: "sw_auto_update",
    category: "software_exposure",
    prompt: "Are automatic updates enabled on your main computer?",
    helpText:
      "Automatic updates close known vulnerabilities before they can be used against you, with no effort on your part.",
    options: [
      { id: "off", label: "No, I update manually or rarely", weight: 0 },
      { id: "os_only", label: "For the operating system only", weight: 2 },
      {
        id: "os_and_apps",
        label: "For the operating system and most apps",
        weight: 4,
      },
    ],
  },
  {
    id: "sw_supported_os",
    category: "software_exposure",
    prompt:
      "Is your main computer running an operating system version that still receives security updates?",
    helpText:
      "An operating system past its end-of-support date stops getting fixes for newly found flaws, no matter how careful you are.",
    options: [
      { id: "unknown", label: "I am not sure", weight: 1 },
      {
        id: "unsupported",
        label: "No, it is an older unsupported version",
        weight: 0,
      },
      {
        id: "supported",
        label: "Yes, it is a currently supported version",
        weight: 4,
      },
    ],
  },
  {
    id: "sw_install_source",
    category: "software_exposure",
    prompt: "Where do you usually get the software you install?",
    helpText:
      "Official app stores and vendor websites are far less likely to bundle malware than search-ad downloads or file-sharing sites.",
    options: [
      { id: "anywhere", label: "Wherever a search result leads", weight: 0 },
      {
        id: "mixed",
        label: "Mostly official sources, sometimes elsewhere",
        weight: 2,
      },
      {
        id: "official",
        label: "Official app stores and vendor sites only",
        weight: 4,
      },
    ],
  },
  {
    id: "sw_admin_account",
    category: "software_exposure",
    prompt: "Do you use an administrator account for everyday computer use?",
    helpText:
      "Working from a standard (non-admin) account limits what malware can change if it does run.",
    options: [
      {
        id: "admin",
        label: "Yes, my daily account is an administrator",
        weight: 1,
      },
      {
        id: "standard",
        label: "No, I use a standard account day to day",
        weight: 4,
      },
      { id: "unknown", label: "I do not know", weight: 0 },
    ],
  },
  // ---- update_habits ----
  {
    id: "upd_os_cadence",
    category: "update_habits",
    prompt:
      "How quickly do you install operating-system security updates once they are offered?",
    helpText:
      "The window between a fix being published and attackers using the flaw is often days. Sooner is materially safer.",
    options: [
      {
        id: "months",
        label: "Weeks or months later, or I postpone them",
        weight: 0,
      },
      { id: "week", label: "Within a week or so", weight: 3 },
      { id: "days", label: "Within a day or two", weight: 4 },
    ],
  },
  {
    id: "upd_phone",
    category: "update_habits",
    prompt: "How current is the software on your phone?",
    helpText:
      "Phones hold your authenticator app, email and messages. An out-of-date phone undermines every other precaution.",
    options: [
      {
        id: "old",
        label: "It no longer gets updates, or I ignore them",
        weight: 0,
      },
      { id: "behind", label: "A version or two behind", weight: 2 },
      {
        id: "current",
        label: "Up to date, updates installed promptly",
        weight: 4,
      },
    ],
  },
  {
    id: "upd_router",
    category: "update_habits",
    prompt:
      "When did you last update your home router's firmware or replace an old router?",
    helpText:
      "Routers are rarely updated and often targeted. Many modern routers update themselves if you enable it.",
    options: [
      { id: "never", label: "Never, or I would not know how", weight: 0 },
      { id: "past_year", label: "Some time in the past year", weight: 2 },
      {
        id: "auto_or_recent",
        label: "It auto-updates, or I checked recently",
        weight: 4,
      },
    ],
  },
];

/** Questions belonging to one category, in definition order. */
export function questionsForCategory(category: CategoryKey): Question[] {
  return QUESTIONS.filter((question) => question.category === category);
}

/** Lookup by id, or `undefined` if no such question exists. */
export function questionById(id: string): Question | undefined {
  return QUESTIONS.find((question) => question.id === id);
}

/**
 * Validate an answer map against the current set. Returns the list of problems;
 * an empty list means every entry names a real question and an offered option.
 * The server uses this to reject an unknown key or an unoffered value before
 * anything is stored.
 */
export function validateAnswers(answers: Record<string, string>): Array<{
  questionId: string;
  problem: "unknown_question" | "unknown_option";
}> {
  const problems: Array<{
    questionId: string;
    problem: "unknown_question" | "unknown_option";
  }> = [];

  for (const [questionId, optionId] of Object.entries(answers)) {
    const question = questionById(questionId);

    if (question === undefined) {
      problems.push({ questionId, problem: "unknown_question" });
      continue;
    }

    if (!question.options.some((option) => option.id === optionId)) {
      problems.push({ questionId, problem: "unknown_option" });
    }
  }

  return problems;
}
