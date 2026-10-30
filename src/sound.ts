let context: AudioContext | undefined;
let active: OscillatorNode[] = [];
export type Sound = 'familiar' | 'uncommon' | 'rare' | 'incorrect' | 'round' | 'complete';
export function unlockSound() {
 try { context ??= new AudioContext(); if (context.state === 'suspended') void context.resume(); } catch { /* Audio is optional. */ }
}
export function stopSound() { active.forEach(o => { try { o.stop(); } catch { /* Already stopped. */ } }); active = []; }
export function playSound(sound: Sound) {
 if (!context || context.state !== 'running') return;
 stopSound();
 const ctx = context, now = ctx.currentTime;
 const notes: Record<Sound, number[]> = { familiar: [440], uncommon: [440, 550], rare: [440, 550, 660], incorrect: [190], round: [440, 550, 660], complete: [440, 550, 660, 880] };
 notes[sound].forEach((frequency, index) => {
  const start = now + index * 0.11, duration = sound === 'incorrect' ? 0.1 : 0.23;
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = 'sine'; osc.frequency.setValueAtTime(frequency, start);
  if (sound === 'incorrect') osc.frequency.exponentialRampToValueAtTime(120, start + duration);
  gain.gain.setValueAtTime(0.001, start); gain.gain.exponentialRampToValueAtTime(0.12, start + 0.006); gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain); gain.connect(ctx.destination); osc.start(start); osc.stop(start + duration + 0.01);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); active = active.filter(a => a !== osc); }; active.push(osc);
 });
}
