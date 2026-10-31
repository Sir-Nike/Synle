# Playtest and dark theme — October 30, 2026

## Content findings

An agent-driven semantic playtest across all twelve prompts selected 64 valid contextual synonyms and 36 invalid opposites/associations before revision. The old bank missed 16 valid submissions, including a US/UK spelling pair. The revised v2 bank accepts all 64 and rejects all 36 invalid examples. These cases are regression-tested in `tests/content-playtest.test.ts`; they are not a human user study or proof of complete synonym coverage.

Added 15 expressions (283 total), with explicit new senses where necessary, including sharp sounds, sharp tastes/smells, enthusiastic warmth, persuasive strength, and clear skies. British `cosy` and American `cozy` map to one answer. WordNet related-sense evidence is retained where available. Remaining editorial references are labelled as such, not claimed to have been individually verified.

Rarity was skewed: 120 of 268 original answers were labelled rare. v2 calibrates frequency thresholds to 4.2 and 2.8 and uses the more frequent spelling's estimate for US/UK variants. New distribution: 70 familiar, 163 uncommon, 50 rare. Phrase scores remain editorial; length is not rewarded.

The October 30 daily challenge and its existing scores remain v1. The revised demo uses a separate v2 save slot. Future scheduled daily challenges use v2. Old demo tokens remain verifiable server-side.

## Interaction fixes

- Network/offline and non-JSON service errors now produce a readable retry message instead of a technical exception. The answer stays typed and no attempt is used.
- Saved display indices are validated before restoration, preventing a blank game screen if the local unsigned display metadata is damaged.
- Development now watches content JSON files as well as server source so answer-bank updates reload reliably.
- Result words align with their rarity indicators.

## Dark theme

Settings offers Light, Dark and Device. The preference is saved; Device follows operating-system appearance changes. An external CSP-compatible startup script applies the selected palette before initial styling to avoid a light flash. Browser/native control colour scheme and the browser theme colour also update.

The palette uses navy surfaces, off-white text, periwinkle actions, mint success feedback, soft pink errors and warm gold rare-answer badges. Semantic colour tokens cover welcome, gameplay, input states, errors, history, summaries, results, help/settings dialogs and notifications.

Calculated dark contrast ratios: body text 15.73:1, secondary text 9.39:1, primary-button text 8.03:1, success feedback 11.26:1, error feedback 10.02:1, gold badges 8.71:1, blue badges 6.41:1, input boundary 4.18:1 against its surface. This is not a complete accessibility audit.

## Verification

18 automated tests cover the HTTP game, legacy scoring, the 100 semantic playtest cases, canonical spellings, calibrated rarity and version preservation. TypeScript/production builds and both content banks validate.

Browser checks include full dark gameplay, duplicate spelling handling, typo correction, incorrect answers, best-three scoring, network failure/retry, early-end confirmation, saved progress recovery, final results and clipboard sharing. Theme and mobile checks are recorded in the follow-up QA notes. Screenshots are saved under ignored `test-results/`.

Appearance-specific browser checks passed: Device follows emulated dark/light changes; native radio-arrow navigation changes selection and palette; a manual Dark override survives refresh with a light device preference. Both 390px mobile results and completed-round review render without horizontal overflow. A separate production-server run verified selecting Dark, submitting a daily answer, serving the startup theme script under the production security policy, and rendering mobile gameplay without browser errors. The real clipboard write was observed successfully; the temporary copied label can expire before slow automation snapshots, so the write itself was checked rather than relying only on the label.

## Remaining limits

Human playtesting is still needed to judge difficulty. Sound design was approved by the user on October 30, 2026. The bank is finite; not every valid synonym or regional expression is covered. This earlier playtest did not cover hosting. Subsequent production account/history verification is recorded in TEST-RESULTS.md. The schedule now runs through December 1, 2026, reusing reviewed words.
