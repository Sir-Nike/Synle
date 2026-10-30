# Synle

## Scope

A daily, full-stack synonym browser game built by one developer in three days, using free hosting. No accounts or public leaderboard in the first version.

## Rules

- Three shared daily prompts, reset at midnight Asia/Kolkata.
- Five submitted attempts per round; the best three valid answers count.
- Familiar: 50 points; uncommon: 75; rare: 100. Maximum daily total: 900.
- Accept close synonyms and established equivalent phrases for any established meaning.
- Accept British and American spelling, reviewed regional expressions and slang from countries where English is a first language. Exclude offensive terms.
- Distinct synonyms count separately. Canonical aliases, spelling and grammatical variants count as one answer.
- Duplicates do not consume an attempt. Invalid answers do.
- Unambiguous minor typos can autocorrect with explicit feedback. Ambiguous corrections require selection before submission.
- Invalid feedback: “Incorrect — try another synonym.” Optional missing-answer report.
- Network failures do not consume attempts.
- End round requires confirmation and retains points from existing submissions.
- Freeze answer banks and scores for published challenges.

## Content

Follow Krillion's documented preparation approach (https://krillion.io/faq): aggregate relevant reference datasets, merge and clean answer sets, use frequency evidence for rarity where practical, and AI assistance plus manual review where necessary. Do not claim Krillion's proprietary scoring formula is known.

First prepare and review five complete prompt banks; expand to twelve for four daily challenges. Check dataset licensing. Record meaning, aliases, source evidence, rarity tier and version for every canonical answer. Assess idioms as whole expressions, not by adding constituent-word rarity. AI candidates require review before publication. Playtest acceptance boundaries and rarity consistency.

## Experience

- Compact centred game column, approximately 560px on desktop; mobile-first.
- Header: Synle, help, sound toggle, settings.
- Show daily challenge, round progress, large prompt, labelled input, Check action, attempts remaining, best three and chronological attempt history.
- Accepted answers reveal only their matched meaning during play. Reveal missed examples and other meanings after the round.
- Clearly explain acceptance, correction, rejection, duplicate, best-three replacement and network failure.
- Preserve input focus; Enter submits; prevent duplicate pending requests.
- First visit: short rules and unrelated example. Returning visit: resume or results.
- Final results: daily total, round breakdown, best answer, spoiler-free copy/share, next-reset countdown.
- End-round control with confirmation.
- Separate demo challenge, isolated from daily progress and scoring, for presentation.
- Progress survives refreshes. One scored game per browser per day is a casual restriction.
- Missing challenge has an explicit unavailable state; never silently reuse a different day's challenge.

## Design direction

Krillion-inspired compact, bold, focused design language; independent branding and no copied ocean theme or assets. Exact reference visuals have not yet been verified.

- Background: #EEF3FA; surface: #FFFFFF.
- Primary text: #202D43; secondary: #526176.
- Primary action and focus: #3659B8.
- Accepted feedback: #176B58; incorrect feedback: #B42338.
- Familiar rarity: neutral/slate; uncommon: pale blue/cobalt; rare: pale gold/dark bronze.
- Bold readable prompt typography, flat surfaces, clear borders, restrained rounding and shadows.
- Verify actual contrast combinations, touch targets, keyboard operation and screen-reader feedback.
- Respect reduced motion; animate meaningful answer and score changes only.

## Sound

Off initially, with a labelled toggle and saved preference. No music, typing or hover sounds. Soft wooden taps and rounded notes: one for familiar, two rising notes for uncommon, a brief three-note flourish for rare; gentle low rejection tap; short round and daily completion chimes. Avoid overlapping outcome sounds. Preview and listen before acceptance; all sound feedback also appears visually.

## Architecture

Planned stack: React, TypeScript, Vite; Node/Express API. Server controls validation, canonicalisation, typo matching and scoring. Do not send unrevealed answer banks to the client.

Versioned JSON content is recoverable from the repository. Local SQLite was proposed; durable hosted database selection remains pending verification of current free-hosting options. Deploy a single service if practical. Do not rely on temporary service disk for durable reports or analytics.

Save browser progress after every attempt and revalidate submitted answers server-side on restoration. Validate request lengths and shape, rate-limit writes, protect secrets, collect minimal anonymous completion/rejection events and answer reports. Do not persist raw offensive input in analytics.

## Delivery

1. One complete round with reviewed sample content and real server-side scoring.
2. Three-round daily flow, saved progress, reset schedule, demo mode, typo handling, sharing and styling.
3. Content review, playtesting, accessibility and audio checks, deployment verification and presentation rehearsal.

Verify consequential rules: meanings, aliases, distinct synonyms, duplicates, correction ambiguity, best-three selection, early end, daily reset, refresh, errors and frozen versions. Keep a documented local presentation fallback.

## Pending

- Review initial content banks and calibrate rarity through playtesting.
- Verify free hosting and durable storage constraints before choosing deployment details.
- Select final fonts and inspect reference screenshot if available.
- Verify visual accessibility in the final hosted build.
- Confirm actual presentation date before scheduling challenges.

## Implementation status

The initial local full-stack build is implemented. React/Vite frontend, Express scoring API, signed browser progress, SQLite reports/events and optional PostgreSQL storage are connected. Twelve initial prompt banks contain 268 accepted expressions. The four scheduled challenges cover October 30–November 2, 2026; the separate demo is always available.

Follow-up: Settings now supports saved Light/Dark/Device appearance. A 100-case agent content playtest led to a v2 bank with 283 expressions and calibrated rarity. The October 30 daily game retains v1; the revised demo and future scheduled daily games use v2. Offline/retry messaging and damaged display-index recovery are improved. See `docs/PLAYTEST.md` for findings and limits.

Automated tests cover scoring, aliases, typos, invalid answers, signed restoration, early ending, IST reset and API validation. Browser checks cover desktop/mobile gameplay, refresh recovery, early-end confirmation, final results, clipboard sharing and sound preview controls. Content source links and rarity cutoffs still need editorial calibration; no claim is made that all linked dictionary pages have been individually verified. Hosting is prepared but not provisioned or deployed.

Sounds were approved by the user on October 30, 2026. Deployment source is the private GitHub repository https://github.com/Sir-Nike/Synle; Render setup uses a free web service and free PostgreSQL Blueprint.
