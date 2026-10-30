"""Create the playtested v2 bank without modifying published v1 content."""
import json
from pathlib import Path
from wordfreq import zipf_frequency
from nltk.corpus import wordnet as wn

root = Path(__file__).resolve().parents[1]
bank = json.loads((root/'content/bank-v1.json').read_text())
bank['version'] = 'v2'
# Explicit contextual synonym decisions from the 64-case semantic playtest.
additions = {
 'bright': [('Giving off or reflecting light', 'sparkling')],
 'light': [('Full of illumination', 'lit')],
 'calm': [('Peaceful and undisturbed', 'untroubled')],
 'sharp': [('Strong or biting in taste or smell', 'pungent'), ('High and piercing in sound', 'shrill')],
 'warm': [('Moderately hot', 'cosy/cozy'), ('Enthusiastic in feeling or response', 'enthusiastic')],
 'cold': [('At a low temperature', 'wintry')],
 'strong': [('Persuasive or well supported', 'convincing')],
 'quiet': [('Making little or no noise', 'subdued')],
 'quick': [('Prompt to understand or respond', 'prompt')],
 'kind': [('Caring and considerate', 'humane')],
 'clear': [('Easy to perceive distinctly', 'distinct'), ('Free of clouds', 'cloudless')],
 'bold': [('Confident and willing to take risks', 'confident')]
}
for prompt in bank['prompts']:
 for label, entry in additions[prompt['id']]:
  meaning = next((m for m in prompt['meanings'] if m['label'] == label), None)
  if meaning is None:
   meaning = {'id': f'{prompt["id"]}-{len(prompt["meanings"])}', 'label': label}
   prompt['meanings'].append(meaning)
  text, *aliases = entry.split('/')
  related = [s.name() for s in wn.synsets(prompt['word']) if any(text in r.lemma_names() for r in [s, *s.similar_tos()])]
  prompt['answers'].append({
   'id':f'{prompt["id"]}:{text}', 'text':text, 'aliases':aliases, 'meaning':meaning['id'],
   'frequency':None,'tier':'uncommon','points':75,
   'source':[f'https://wordnet.princeton.edu/ — related sense {s}' for s in related] or [f'https://dictionary.cambridge.org/dictionary/english/{text}',f'https://dictionary.cambridge.org/thesaurus/{prompt["word"]}'],
   'review':'Contextual semantic playtest: accepted in the labelled sense. '+('WordNet related-sense evidence.' if related else 'Editorial judgement; dictionary references remain for human verification.')})
 for answer in prompt['answers']:
  if ' ' not in answer['text']:
   # US/UK variants share a score; use the more common spelling's usage evidence.
   freq = max(zipf_frequency(f,'en') for f in [answer['text'],*answer['aliases']] if ' ' not in f)
   answer['frequency'] = round(freq,2)
   answer['tier'] = 'familiar' if freq >= 4.2 else 'uncommon' if freq >= 2.8 else 'rare'
   answer['points'] = {'familiar':50,'uncommon':75,'rare':100}[answer['tier']]
  answer['review'] += ' v2 rarity calibration after playtesting.'
(root/'content/bank-v2.json').write_text(json.dumps(bank,ensure_ascii=False,indent=2)+'\n')
print(f'Prepared v2: {sum(len(p["answers"]) for p in bank["prompts"])} answers. v1 unchanged.')
