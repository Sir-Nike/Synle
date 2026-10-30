"""Reproducible candidate preparation. See docs/CONTENT.md before publishing edits.
Run with .venv/bin/python scripts/prepare_content.py. No Python needed at runtime.
"""
import json
from pathlib import Path
import nltk
from nltk.corpus import wordnet as wn
from wordfreq import zipf_frequency

ROOT = Path(__file__).resolve().parents[1]
nltk.download('wordnet', quiet=True)

# Meaning boundaries and phrase tiers are editorial. Never automatically accept
# every lemma: WordNet contains dated/offensive words and unrelated senses.
# Each tuple is (sense label, reviewed candidates, phrase tiers if applicable).
SEEDS = {
 'bright': [
  ('Intelligent or quick to understand', 'clever|smart|intelligent|astute|brainy|brilliant|sharp|quick-witted|perceptive|shrewd', {}),
  ('Giving off or reflecting light', 'radiant|luminous|shining|brilliant|gleaming|glowing|dazzling|lustrous|resplendent|effulgent|shiny|glittering|shimmering|illuminated|light|well-lit', {}),
  ('Vivid in colour', 'vivid|vibrant|colourful/colorful|brilliant|intense', {}),
  ('Cheerful and optimistic', 'cheerful|sunny|buoyant|upbeat|hopeful|optimistic|happy|merry', {})],
 'light': [
  ('Not heavy', 'lightweight/light weight|weightless|feathery|airy|featherlight|light as a feather', {'light as a feather':'uncommon'}),
  ('Illumination', 'illumination|radiance|luminescence|glow|brightness|luminosity', {}),
  ('Pale in colour', 'pale|fair|pastel|faint', {}),
  ('Full of illumination', 'bright|illuminated|well-lit', {}),
  ('Gentle or low in intensity', 'gentle|mild|delicate|slight', {}),
  ('To set burning', 'ignite|kindle|set alight|set fire to', {'set alight':'uncommon','set fire to':'familiar'})],
 'calm': [
  ('Peaceful and undisturbed', 'peaceful|tranquil|serene|still|quiet|placid|unruffled|halcyon', {}),
  ('Composed and free from agitation', 'composed|collected|relaxed|unflustered|equanimous|cool-headed|cool|level-headed|self-possessed|at ease/being at ease|cool as a cucumber/as cool as a cucumber', {'at ease':'familiar','cool as a cucumber':'uncommon'}),
  ('To make less agitated', 'soothe|settle|pacify|reassure|mollify|appease', {})],
 'sharp': [
  ('Having a fine cutting edge or point', 'keen|pointed|razor-sharp|acute', {}),
  ('Quick to understand or notice', 'astute|perceptive|shrewd|clever|intelligent|observant|quick-witted', {}),
  ('Sudden and substantial', 'abrupt|sudden|steep|drastic|precipitous', {}),
  ('Harsh or biting in manner', 'curt|acerbic|cutting|caustic|biting|tart', {})],
 'warm': [
  ('Moderately hot', 'mild|balmy|tepid|lukewarm|toasty', {}),
  ('Friendly and affectionate', 'friendly|affectionate|cordial|welcoming|genial|amiable|hearty|kind-hearted', {}),
  ('To make warmer', 'heat|reheat|warm up', {'warm up':'familiar'})],
 'cold': [
  ('At a low temperature', 'chilly|cool|frigid|icy|freezing|frosty|gelid|nippy|baltic', {}),
  ('Unfriendly or lacking affection', 'aloof|distant|unfriendly|unfeeling|detached|impersonal|standoffish|frosty', {}),
  ('Without emotion or pity', 'dispassionate|emotionless|heartless|unemotional|callous', {})],
 'strong': [
  ('Having physical power or strength', 'powerful|mighty|muscular|brawny|robust|strapping|herculean', {}),
  ('Able to withstand force or difficulty', 'sturdy|tough|resilient|durable|solid|hardy|steadfast|tenacious', {}),
  ('Intense or potent', 'intense|potent|powerful|concentrated|pungent|forceful', {})],
 'quiet': [
  ('Making little or no noise', 'silent|hushed|noiseless|muted|soundless|soft|inaudible', {}),
  ('Peaceful and without disturbance', 'peaceful|calm|tranquil|serene|still|undisturbed', {}),
  ('Not talkative or showy', 'reserved|reticent|taciturn|unassuming|understated|soft-spoken', {})],
 'quick': [
  ('Moving or happening fast', 'fast|swift|rapid|speedy|fleet|brisk|expeditious|like a shot|in a flash', {'like a shot':'uncommon','in a flash':'familiar'}),
  ('Taking little time', 'brief|short|fleeting|momentary|hasty', {}),
  ('Prompt to understand or respond', 'alert|nimble|agile|sharp|quick-witted|perceptive|responsive', {})],
 'kind': [
  ('Caring and considerate', 'caring|considerate|thoughtful|benevolent|compassionate|gentle|generous|benign|big-hearted|good-hearted|nice', {}),
  ('A category or variety', 'type|sort|variety|category|class|species|genre|ilk', {})],
 'clear': [
  ('Easy to understand', 'plain|obvious|evident|explicit|unambiguous|lucid|intelligible|pellucid', {}),
  ('Transparent or easy to see through', 'transparent|limpid|crystalline|see-through', {}),
  ('Free of obstructions', 'unobstructed|open|unimpeded|unblocked', {}),
  ('To remove things from a place', 'empty|remove|evacuate|vacate', {})],
 'bold': [
  ('Confident and willing to take risks', 'brave|daring|fearless|courageous|audacious|intrepid|dauntless|adventurous|plucky|gutsy', {}),
  ('Striking and conspicuous', 'striking|conspicuous|prominent|vivid|eye-catching', {}),
  ('Impudent or overly forward', 'brazen|impudent|forward|cheeky|impertinent|brash', {})]
}

prompts = []
for word, senses in SEEDS.items():
    meanings, answers, canonical = [], [], set()
    for index, (label, candidates, phrase_tiers) in enumerate(senses):
        meaning_id = f'{word}-{index}'
        meanings.append({'id': meaning_id, 'label': label})
        for entry in candidates.split('|'):
            text, *aliases = entry.split('/')
            if text in canonical:
                continue  # One expression cannot fill multiple scoring slots.
            canonical.add(text)
            # Phrase frequencies from wordfreq are estimates from constituent
            # tokens, so do not present them as measured idiom usage.
            frequency = None if ' ' in text else round(zipf_frequency(text, 'en'), 2)
            tier = phrase_tiers.get(text) or ('familiar' if frequency is not None and frequency >= 4.5 else 'uncommon' if frequency is not None and frequency >= 3.4 else 'rare')
            shared = [s.name() for s in wn.synsets(word) if text.replace('-', '_').replace(' ', '_') in s.lemma_names()]
            source = [f'https://wordnet.princeton.edu/ — sense {s}' for s in shared]
            # Dictionary sense links record where to verify editorial additions.
            if not source:
                source = [f'https://dictionary.cambridge.org/dictionary/english/{word}', f'https://dictionary.cambridge.org/dictionary/english/{text.replace(" ", "-")}']
            answers.append({'id': f'{word}:{text.replace(" ", "-")}', 'text': text, 'aliases': aliases,
              'meaning': meaning_id, 'tier': tier, 'points': {'familiar':50,'uncommon':75,'rare':100}[tier],
              'source': source, 'frequency': frequency,
              'review': 'WordNet shared-sense candidate' if shared else 'Editorial semantic match; dictionary links for verification'})
    prompts.append({'id':word,'word':word,'meanings':meanings,'answers':answers})

(ROOT/'content/bank-v1.json').write_text(json.dumps({'version':'v1','prompts':prompts}, ensure_ascii=False, indent=2)+'\n')
# Guard autocorrect against changing correctly spelled real words into synonyms.
known = sorted({lemma.replace('_',' ').lower() for lemma in wn.all_lemma_names()} | {p['word'] for p in prompts} | {a['text'] for p in prompts for a in p['answers']})
(ROOT/'content/known-words.json').write_text(json.dumps(known, ensure_ascii=False)+'\n')
print(f'Prepared {len(prompts)} prompts, {sum(len(p["answers"]) for p in prompts)} answers, {len(known)} spelling guards.')
