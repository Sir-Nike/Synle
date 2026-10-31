# Content preparation and review

## Current bank

12 prompts, 268 candidate answers. Prompts are bright, light, calm, sharp, warm, cold, strong, quiet, quick, kind, clear and bold. The schedule covers **October 30 through December 1, 2026**, one three-word challenge per day. Dates after November 2 reuse the twelve reviewed v2 words in rotating combinations. This is an extension of availability, not an expanded vocabulary bank. Published entries and scores remain unchanged. No later challenge is silently substituted. The demo always uses bright, light and calm and is separately saved.

This is an initial editorial bank, not an exhaustive dictionary. Its semantic matches were selected during development; dictionary links on editorial entries indicate where a human reviewer can verify them, and are **not a claim that each linked page has been individually checked**. Regional/slang coverage is currently limited (e.g. *baltic*, *nippy*, *gutsy*); it does not yet cover every eligible English-speaking region.

## Method

### Playtested revision (v2)

The demo and daily challenges from October 31, 2026 use `bank-v2.json`: **283 expressions** across the same twelve prompts. The October 30 daily challenge remains on v1 (268 expressions), preserving its scores. Legacy v1 demo tokens remain verifiable; the revised demo starts in a separate browser-storage slot.

A semantic playtest used 64 independently selected valid examples and 36 opposites/loose associations. The original bank missed 16 valid submissions (15 expressions plus the alternate spelling `cozy`). v2 adds these with explicit sense labels. Examples include sparkling, lit, untroubled, pungent, shrill, cosy/cozy, enthusiastic, wintry, convincing, subdued, prompt, humane, distinct, cloudless and confident. These remain editorial judgements with WordNet related-sense evidence where available; inaccessible dictionary reference pages are not claimed to have been verified.

The original cutoffs over-rewarded everyday vocabulary. v2 uses Zipf **4.2+ = familiar**, **2.8–4.2 = uncommon**, **below 2.8 = rare**, with editorial phrase ratings retained. British/American variants use the more frequent spelling's estimate and share one canonical score. The resulting v2 distribution is 70 familiar, 163 uncommon and 50 rare expressions. This is calibration from an agent playtest, not a human user study.

Reproduce candidate revision with `.venv/bin/python scripts/revise_content.py`. This reads v1 and writes v2; do not regenerate v2 after its publication. The regression cases live in `tests/content-playtest.test.ts`.

### Original bank (v1)

Following the preparation model described in the [Krillion FAQ](https://krillion.io/faq), Synle aggregates reference candidates, deduplicates canonical expressions, and prepares scores before play. Krillion's exact scoring algorithm is not known or reproduced.

`scripts/prepare_content.py` checks editorial selections against Princeton WordNet synonym sets and records shared sense IDs where found. Other entries retain verification URLs and an editorial-match label. It also creates a real-word spelling guard from WordNet so correctly spelled words aren't casually autocorrected to synonyms.

Single-word rarity uses `wordfreq` 3.1.1 English Zipf estimates:

- >= 4.5: familiar, 50 points.
- >= 3.4 and < 4.5: uncommon, 75 points.
- < 3.4: rare, 100 points.

These are prototype cutoffs, not measured player familiarity. Frequency measures usage of a word across senses; it cannot tell whether a particular sense is familiar. Very low-frequency entries need especially careful review. Hyphenated expressions also require review because tokenization can affect estimates.

**Multi-word idioms use editorial tiers.** wordfreq can estimate token sequences, but that is not equivalent to measured usage of an idiom as a whole. The script deliberately stores a null frequency for space-separated phrases. It never multiplies constituent rarity or rewards length.

## Regenerate candidates

Python is only a development/content-authoring dependency:

```sh
python3 -m venv .venv
.venv/bin/pip install nltk==3.10.4 wordfreq==3.1.1
.venv/bin/python scripts/prepare_content.py
npm run content:check
npm test
```

Regeneration overwrites `bank-v1.json`; use it only before publishing v1. For later edits, duplicate the bank as v2, change its internal version, register it in `server/game.ts`, and schedule future challenges against v2. Preserve v1 for old signed progress. Never regenerate a published bank in place.

Before publication, review each answer for semantic fit, exact sense, offensiveness, regional eligibility and canonical aliases. Playtest at least five complete banks before expanding. Machine validation checks structure, duplicates, source metadata, tiers, schedule references and profanity; it does not prove semantic correctness or licensing of newly added sources.

## Attribution and licences

- **Princeton WordNet 3.0**: Princeton University. Synonym/lemma data and shared-sense evidence; original notice preserved in [WORDNET-LICENSE.txt](WORDNET-LICENSE.txt). See [WordNet citation guidance](https://wordnet.princeton.edu/citing-wordnet).
- **wordfreq 3.1.1**, Robyn Speer and contributors: frequency estimates derived from its English data. Code under Apache 2.0; data under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). See [upstream attribution and data sources](https://github.com/rspeer/wordfreq). The bank's derived frequency values and accompanying adapted data are distributed under CC BY-SA 4.0, with original WordNet notices retained. This does not assign a licence to unrelated application code.
- Cambridge dictionary URLs are verification references only. Cambridge dictionary text has not been scraped or redistributed.
- **Lexend** and **Source Sans 3** are distributed through `@fontsource` under the SIL Open Font License. Original font licences remain in their installed packages.

No live LLM or paid API is used at runtime. New AI-generated candidates must be checked before entering a published bank.
