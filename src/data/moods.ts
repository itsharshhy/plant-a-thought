export const MOODS = [
  ['happy', '😊', 'Happy', '#FFD27A'],
  ['sad', '😢', 'Sad', '#8FC7D9'],
  ['angry', '😠', 'Angry', '#F0A04B'],
  ['anxious', '😰', 'Anxious', '#E8B7F0'],
  ['calm', '😌', 'Calm', '#9CC283'],
] as const;
export type Mood = (typeof MOODS)[number][0];
export const MOOD_IDS = MOODS.map((m) => m[0]) as readonly Mood[];
export const moodColor = (m?: string | null) => MOODS.find((x) => x[0] === m)?.[3];
export const moodEmoji = (m?: string | null) => MOODS.find((x) => x[0] === m)?.[1] || '';
export const isMood = (m: unknown): m is Mood => MOOD_IDS.includes(m as Mood);
