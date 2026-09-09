# Contributing to Soteria

Work from one short-lived branch per issue. Use names such as
`feat/US-01-breach-check`, `infra/INF-02-scaffold`, or `fix/US-01-clear-input`.
Keep commits small and focused, and reference the issue in the pull request.

For materially AI-assisted work, add one of these commit trailers:

```text
AI-Assisted: Codex
AI-Assisted: Claude
```

Before requesting review, update from `main`, run the relevant checks, verify
the issue's acceptance criteria, and complete the pull request template. A
second human team member must review AI-assisted changes. Do not approve your
own pull request. Merge with squash merge only after required checks and review
pass; never push directly to `main`.

Never commit secrets, personal data, passwords, generated credentials, full
password hashes, or password-manager vault contents.
