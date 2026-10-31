export type Tier = 'familiar' | 'uncommon' | 'rare';
export interface Answer {
  id: string;
  text: string;
  aliases: string[];
  meaning: string;
  tier: Tier;
  points: number;
  source: string[];
  frequency: number | null;
  review: string;
}
export interface Prompt {
  id: string;
  word: string;
  meanings: { id: string; label: string }[];
  answers: Answer[];
}
export interface Bank {
  version: string;
  prompts: Prompt[];
}
export interface Challenge {
  id: string;
  date: string;
  number: number;
  promptIds: string[];
  version: string;
}
export interface Attempt {
  input: string;
  answerId?: string;
  corrected?: boolean;
}
export interface Round {
  attempts: Attempt[];
  ended: boolean;
}
export interface State {
  owner?: string;
  challengeId: string;
  version: string;
  mode: 'daily' | 'demo';
  rounds: Round[];
  revision: number;
}
export interface ScoredAttempt {
  input: string;
  text: string;
  accepted: boolean;
  corrected: boolean;
  points: number;
  tier?: Tier;
  meaning?: string;
  answerId?: string;
  index: number;
}
export interface PublicRound {
  word: string;
  attempts: ScoredAttempt[];
  best: ScoredAttempt[];
  score: number;
  ended: boolean;
  remaining: number;
  discoveries: number;
  reveal?: {
    meaning: string;
    examples: { text: string; tier: Tier; points: number }[];
  }[];
}
export interface GameView {
  mode: 'daily' | 'demo';
  date: string;
  number: number;
  challengeId: string;
  revision: number;
  rounds: PublicRound[];
  currentRound: number;
  complete: boolean;
  total: number;
  token: string;
  nextReset: string;
}
export interface Feedback {
  kind: 'accepted' | 'incorrect' | 'duplicate' | 'suggestions' | 'ended';
  message: string;
  tier?: Tier;
  suggestions?: string[];
  increase?: number;
}
