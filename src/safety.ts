/**
 * Gentle crisis check. It never blocks or reports anything; it only offers help to the writer on their own screen.
 * Covers English, Hindi (Devanagari) and common romanised Hindi.
 */
const PATTERNS = [
  /\bsuicid/i, /\bkill(ing)?\s+my\s*self\b/i, /\bend\s+(it\s+all|my\s+life)\b/i, /\bwant(ed)?\s+to\s+die\b/i,
  /\b(don'?t|do\s+not)\s+want\s+to\s+(live|be\s+alive|exist)\b/i, /\bself[\s-]?harm/i, /\bcut(ting)?\s+my\s*self\b/i,
  /\bno\s+reason\s+to\s+live\b/i, /\bbetter\s+off\s+(dead|without\s+me)\b/i, /\bhurt(ing)?\s+my\s*self\b/i,
  /आत्महत्या/, /ख़?ुदकुशी/, /मर\s*जाना\s*चाह/, /मरना\s*चाह/, /जीना\s*नहीं\s*चाह/,
  /\bkhudkushi\b/i, /\baatmahatya\b/i, /\bmarna\s+chaht/i, /\bmar\s+jana\s+chaht/i, /\bjeena\s+nahi\s+chaht/i,
];

export const needsSupport = (text: string) => PATTERNS.some((p) => p.test(text));

export const HELPLINES: [string, string, string][] = [
  ['India', 'Tele-MANAS (free, 24/7, many languages)', 'tel:14416'],
  ['India', 'Emergency', 'tel:112'],
  ['USA', '988 Suicide & Crisis Lifeline', 'tel:988'],
  ['UK & Ireland', 'Samaritans', 'tel:116123'],
  ['Anywhere', 'Find a helpline near you', 'https://findahelpline.com'],
];
