import { hash } from '../core/util';
import { load, save } from '../core/store';
import type { Lang } from './profile';

/**
 * A pack is a list of tiers (light → deep). Packs with one tier ignore depth.
 * `hi` lists, when present, are line-by-line translations of `en`, so the daily question matches across languages.
 */
export interface Pack { id: string; name: string; emoji: string; desc: string; en: string[][]; hi?: string[][] }

const everydayEn = [
  ['What are you grateful for today?', 'Something small that made you smile', 'A sound you love', 'Someone who helped you lately', 'A taste that feels like home', 'A place that makes you feel safe', 'A song that lifts your mood', 'A tiny win from this week', 'A smell that brings back a good memory', 'Something in nature you adore', 'A person you are glad you met', 'Your favourite part of today', 'One word for your mood right now', 'Something you are looking forward to', 'A comfort food you never get tired of', 'Something kind someone said to you'],
  ['What is weighing on your mind lately?', 'A moment you were proud of', 'Something you wish you had said', 'What made you smile this week?', 'A worry you are ready to let go of', 'What do you need more of right now?', 'Something you learned about yourself recently', 'A habit you would like to start', 'What does a good day look like for you?', 'A time you were braver than you thought', 'What are you tired of carrying?', 'Who made your life easier this month?', 'What would make tomorrow a little better?', 'A boundary you want to keep', 'Something you are slowly getting better at', 'What drains your energy, and what refills it?'],
  ['What do you need to hear right now?', 'A fear you rarely admit', 'Who do you miss, and why?', 'What would you forgive yourself for?', 'What does your heart want more of?', 'What are you pretending not to feel?', 'What would you tell your younger self?', 'What part of you needs gentleness?', 'What do you wish people understood about you?', 'What would you do if you were not afraid?', 'What are you proud of that nobody sees?', 'What does home mean to you?', 'A hope you have not said out loud', 'What would it feel like to rest without guilt?', 'What are you still healing from?', 'Who are you becoming?'],
];

const everydayHi = [
  ['आज आप किस बात के लिए आभारी हैं?', 'कोई छोटी-सी बात जिसने आपको मुस्कुराया', 'एक आवाज़ जो आपको बहुत पसंद है', 'हाल ही में किसने आपकी मदद की?', 'एक स्वाद जो घर जैसा लगता है', 'एक जगह जहाँ आप सुरक्षित महसूस करते हैं', 'एक गाना जो आपका मूड अच्छा कर देता है', 'इस हफ़्ते की एक छोटी-सी जीत', 'एक खुशबू जो कोई अच्छी याद दिलाती है', 'प्रकृति की कोई चीज़ जो आपको बहुत प्यारी है', 'कोई इंसान जिससे मिलकर आप खुश हैं', 'आज का आपका सबसे अच्छा पल', 'अभी के मूड के लिए एक शब्द', 'कुछ जिसका आपको इंतज़ार है', 'एक पसंदीदा खाना जिससे आपका मन कभी नहीं भरता', 'किसी की कही कोई प्यारी बात'],
  ['आजकल आपके मन पर क्या बोझ है?', 'एक पल जब आपको ख़ुद पर गर्व हुआ', 'कुछ जो आप कहना चाहते थे पर कह न सके', 'इस हफ़्ते किस बात ने आपको मुस्कुराया?', 'एक चिंता जिसे आप अब छोड़ने को तैयार हैं', 'अभी आपको किस चीज़ की ज़्यादा ज़रूरत है?', 'हाल ही में आपने अपने बारे में क्या सीखा?', 'एक आदत जो आप शुरू करना चाहते हैं', 'आपके लिए एक अच्छा दिन कैसा होता है?', 'एक बार जब आप सोच से ज़्यादा बहादुर निकले', 'आप क्या ढोते-ढोते थक गए हैं?', 'इस महीने किसने आपकी ज़िंदगी आसान बनाई?', 'कल को थोड़ा बेहतर क्या बना सकता है?', 'एक सीमा जिसे आप बनाए रखना चाहते हैं', 'कुछ जिसमें आप धीरे-धीरे बेहतर हो रहे हैं', 'आपकी ऊर्जा क्या छीनता है, और क्या लौटाता है?'],
  ['अभी आपको क्या सुनने की ज़रूरत है?', 'एक डर जिसे आप कम ही मानते हैं', 'आप किसे याद करते हैं, और क्यों?', 'आप ख़ुद को किस बात के लिए माफ़ करना चाहेंगे?', 'आपका दिल किस चीज़ की और चाह रखता है?', 'आप क्या महसूस न करने का दिखावा कर रहे हैं?', 'आप अपने बचपन के रूप से क्या कहेंगे?', 'आपके किस हिस्से को नरमी की ज़रूरत है?', 'आप चाहते हैं लोग आपके बारे में क्या समझें?', 'अगर डर न होता तो आप क्या करते?', 'किस बात पर आपको गर्व है जो कोई नहीं देखता?', 'आपके लिए घर का मतलब क्या है?', 'एक उम्मीद जो आपने कभी ज़ोर से नहीं कही', 'बिना अपराध-बोध के आराम करना कैसा लगेगा?', 'आप अब भी किस चीज़ से उबर रहे हैं?', 'आप कौन बनते जा रहे हैं?'],
];

export const PACKS: Pack[] = [
  { id: 'everyday', name: 'Everyday', emoji: '🌿', desc: 'Starts light, gets deeper as you climb', en: everydayEn, hi: everydayHi },
  {
    id: 'friends', name: 'Friends', emoji: '🫶', desc: 'For a group chat or a hangout',
    en: [['A memory with friends that still makes you laugh', 'Something you never thanked a friend for', 'A friend who taught you something important', 'A trip you want to take together', 'Your go-to comfort show or song', 'Something everyone should try once', 'A compliment for someone here', 'What are you excited about lately?', 'A skill you could teach the group', 'When did you feel like you belonged?', 'Your best advice in five words', 'Something you are proud of this month']],
  },
  {
    id: 'couples', name: 'Couples', emoji: '💞', desc: 'For two people who care about each other',
    en: [['A small thing I do that you love', 'A memory of us you replay often', 'Something you want us to try together', 'When did you feel most supported by me?', 'A song that feels like us', 'A perfect lazy day together looks like…', 'Something you have never told me', 'What makes you feel loved?', 'A place you want us to go', 'What should we do more of?', 'One thing you appreciate about me today', 'A tiny promise for this week']],
  },
  {
    id: 'team', name: 'Team check-in', emoji: '🤝', desc: 'Stand-ups, retros and team rituals',
    en: [['One win from this week', 'Something that slowed you down', 'Who helped you this week?', 'One thing we should keep doing', 'One thing we should stop doing', 'Your energy today in one word', 'A small experiment for next week', 'Something you learned recently', 'What would make your work easier?', 'A shout-out for a teammate', 'What are you curious about?', 'A risk we are not talking about']],
  },
  {
    id: 'kids', name: 'Kids & class', emoji: '🎒', desc: 'Gentle questions for classrooms',
    en: [['What made you laugh today?', 'Your favourite animal and why', 'If you had a superpower, what would it be?', 'Something you are good at', 'A food you love', 'Someone who was kind to you', 'What makes you feel brave?', 'A place you love to play', 'Something new you learned', 'What do you do when you feel sad?', 'Something that makes you feel calm', 'Your dream adventure']],
    hi: [['आज किस बात पर हँसी आई?', 'आपका पसंदीदा जानवर और क्यों', 'अगर आपके पास कोई सुपरपावर होती, तो वो क्या होती?', 'कुछ जिसमें आप अच्छे हैं', 'एक खाना जो आपको बहुत पसंद है', 'कोई जो आपके साथ अच्छे से पेश आया', 'आपको बहादुर क्या महसूस कराता है?', 'एक जगह जहाँ आपको खेलना पसंद है', 'आज आपने क्या नया सीखा?', 'जब आप उदास होते हैं तो क्या करते हैं?', 'कुछ जो आपको शांत महसूस कराता है', 'आपका सपनों वाला सफ़र']],
  },
  {
    id: 'exams', name: 'Exam season', emoji: '📚', desc: 'For study stress and the days before results',
    en: [['What are you most worried about right now?', 'One topic you understand better than last week', 'A small study win today', 'What helps you focus?', 'How will you rest tonight?', 'Someone you can ask for help', 'How will you celebrate after exams?', 'A kind thing to tell yourself before the exam', 'One thing you can control today', 'Your favourite study snack', 'Something you are proud of beyond marks', 'What would you tell a friend who is stressed?']],
    hi: [['अभी आपको सबसे ज़्यादा किस बात की चिंता है?', 'एक टॉपिक जो पिछले हफ़्ते से बेहतर समझ आया', 'आज की पढ़ाई की एक छोटी जीत', 'आपको ध्यान लगाने में क्या मदद करता है?', 'आज रात आप आराम कैसे करेंगे?', 'कोई जिससे आप मदद माँग सकते हैं', 'परीक्षा के बाद आप जश्न कैसे मनाएँगे?', 'परीक्षा से पहले ख़ुद से कहने वाली एक प्यारी बात', 'आज की एक चीज़ जो आपके बस में है', 'पढ़ाई के समय का पसंदीदा नाश्ता', 'नंबरों से परे कुछ जिस पर आपको गर्व है', 'तनाव में किसी दोस्त से आप क्या कहेंगे?']],
  },
];

/** Approved community questions are loaded from the server at runtime. */
export const community: Record<Lang, string[]> = { en: [], hi: [] };
export const COMMUNITY: Pack = { id: 'community', name: 'Community', emoji: '🌍', desc: 'Questions suggested by players', en: [[]] };

export function getPack(id: string): Pack {
  if (id === 'community') return { ...COMMUNITY, en: [community.en], hi: [community.hi] };
  return PACKS.find((p) => p.id === id) || PACKS[0];
}

export function allPacks(): Pack[] {
  return community.en.length || community.hi.length ? [...PACKS, getPack('community')] : PACKS;
}

/** Tiers for a pack in a language, falling back to English. */
export function tiersFor(pack: Pack, lang: Lang): string[][] {
  const hi = pack.hi?.filter((t) => t.length);
  const list = lang === 'hi' && hi?.length ? hi : pack.en;
  const ok = list.filter((t) => t.length);
  return ok.length ? ok : everydayEn;
}

/**
 * Pick a question the player has not seen recently in this pack. Remembers what was used so
 * questions only repeat once the whole tier has been seen.
 */
export function pickPrompt(packId: string, lang: Lang, depth: number, random = Math.random): string {
  const tiers = tiersFor(getPack(packId), lang);
  const pool = tiers[Math.min(Math.max(0, depth), tiers.length - 1)];
  const key = 'pat-q';
  let used = load<string[]>(key, []);
  let src = pool.filter((q) => !used.includes(q));
  if (!src.length) { used = used.filter((q) => !pool.includes(q)); src = pool; }
  const q = src[Math.floor(random() * src.length)];
  used.push(q);
  save(key, used.slice(-400));
  return q;
}

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Everyone gets the same daily question (light and reflective tiers only, never the deep tier). */
export function dailyPrompt(day: string, lang: Lang): string {
  const tiers = lang === 'hi' ? everydayHi : everydayEn;
  const list = [...tiers[0], ...tiers[1]];
  return list[hash('daily:' + day) % list.length];
}

/** Everyone gets the same island layout on the same day. */
export const dailySeed = (day: string) => (hash('seed:' + day) % 1_000_000_000) + 1;

/** Depth for the n-th thought of a run: 2 light, 2 reflective, then deep. */
export const depthFor = (n: number) => Math.min(2, Math.floor(n / 2));
