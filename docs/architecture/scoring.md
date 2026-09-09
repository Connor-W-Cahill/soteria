# How Soteria scores your posture

US-17. Written in plain language on purpose: US-18 shows users the reasons behind
their scores, and a rule that cannot be explained in a sentence is a rule that
should not be in the product.

The implementation is [`shared/src/scoring/engine.ts`](../../shared/src/scoring/engine.ts).
The questions and their weights are in
[`shared/src/scoring/questions.ts`](../../shared/src/scoring/questions.ts).

## The short version

Every answer is worth points. A category's score is the points you earned in that
category, out of the points those same questions could have given you, as a
percentage. The overall score is the same sum across all five categories at once.

## The five categories

| Category                     | What it asks about                                         |
| ---------------------------- | ---------------------------------------------------------- |
| `password_hygiene`           | Reuse, password managers, password length                  |
| `breach_preparedness`        | Whether you check for breaches and what you do about them  |
| `multifactor_authentication` | MFA on email and finances, and which second factor you use |
| `software_exposure`          | Updates, supported versions, install sources, admin rights |
| `update_habits`              | How quickly you apply OS, phone and router updates         |

The order is fixed (`CATEGORY_KEYS`) so the five cards never reshuffle between
loads.

## The rules

### 1. Points live with the questions, not in the engine

Each answer option carries a weight from 0 to 4, defined next to the question a
human reads. Every question offers exactly one option worth 4, so "the best
answer" is always well defined.

This is deliberate: it keeps "what a good answer looks like" beside the question
instead of in a scoring table nobody reads, and it means changing an opinion about
a habit is a one-line edit in one file.

### 2. A category is scored out of the questions you answered

    score = round(100 x points earned / (4 x questions answered))

**Answered**, not total. If you answer one password question perfectly and stop,
password hygiene reads 100 out of the one question you answered, not 33 out of
three. Scoring partial answers against the full denominator would make an
unfinished form look like bad habits, and the questionnaire is explicitly designed
to be saved and resumed.

Each category also reports `answered` and `total`, so the interface can say "3 of
3 answered" rather than leaving you to guess whether a low score means bad habits
or an unfinished form.

### 3. Not answered is not zero

A category you have said nothing about scores `null`, not 0. A brand-new account
has no score at all rather than a score of zero, because "we don't know" and "this
is bad" are different statements and only one of them is true.

Zero is still reachable: answer every question in a category with its weakest
option and you will see 0 (in categories where a 0-weight option exists — see the
note below).

### 4. The overall score weights categories by how many questions they have

The overall score is recomputed from the raw points across all sixteen questions,
**not** by averaging the five category percentages.

Averaging percentages would give a category with one question the same pull as a
category with four. Software exposure has four questions and the others have
three, so under averaging a single software answer would move your overall score
by more than a single password answer — which is not what the questions say.

### 5. Software exposure is provisional until the CVE matcher exists

`software_exposure` is the only category with an input from outside the
questionnaire: the known vulnerabilities affecting software you have listed
(US-24). That does not exist yet.

Until it does, the category is scored from your answers alone and flagged
`provisional: true`, and its explanation says so in words:

> This category will also account for known vulnerabilities affecting the
> software you list. That check is not part of this build yet, so this score
> reflects your answers only.

It does **not** substitute a neutral 50 and present it as measured. A made-up
number that looks like a measurement is worse than an honest gap, because nobody
can tell it is made up.

### 6. An answer we do not recognise is treated as unanswered

If a stored answer names an option its question does not offer — which can only
happen if the question set changed under a saved submission — it is treated as
unanswered rather than scored 0. Scoring it 0 would report a habit you never
claimed.

Answers are validated against the question set when they are saved, so this is a
safety net rather than a normal path.

### 7. The engine is a pure function

Same answers in, same scores out. No clock, no randomness, no database, no
network. Three things follow, and they are the reason it is built this way:

- the fixture tests in `engine.test.ts` mean something, because there is nothing
  for them to be flaky about;
- US-18's explanations are **regenerated** from your stored answers rather than
  stored as prose, so an explanation can never drift out of step with the rules
  that produced it;
- `GET /api/scores` recomputes on every read, so a change to these rules takes
  effect for everyone immediately instead of leaving people looking at numbers
  produced by rules that no longer exist.

## What is stored, and what is not

`score_snapshots` gets one row per category each time you save answers. It is
**history, for the trend chart in US-19 — not a cache.** Nothing reads it to
answer `GET /api/scores`.

Each row holds the category, the score, and a short mechanical note like
`3 of 3 questions answered`. It does not hold your answers (those live in
`questionnaire_responses`) and it does not hold the explanation text. A category
with no score is not written at all, rather than written as 0, so the trend chart
never shows a low point you did not earn.

If a snapshot write fails, the answer save still succeeds. Your answers are the
thing that matters and they are already committed by that point; losing one point
from a history chart is a smaller harm than being told your answers did not save
when they did.

## A note on the floor

One question — "do you use a different email address for important accounts?" —
has no zero-weight option, because using one address for everything is weak but
not literally no preparedness. The practical effect is that the lowest achievable
overall score is 2, not 0. This is a property of the question set rather than of
the engine, and the tests derive it from the data instead of hard-coding it, so
reweighting a question does not require editing a test to match.

## Changing the rules

Bump `QUESTIONNAIRE_VERSION` whenever a question id, an option id, or a weight
changes. Submissions store the version they were answered under, so US-19's
history can tell "your habits improved" from "we changed how we count".
