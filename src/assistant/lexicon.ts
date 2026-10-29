/* Everyday shorthand, French, Arabic and Tunisian Derja (Latin script) mapped to the English words the router and the
 * retriever understand. A small word list, not a translator: it covers the questions a visitor is likely to ask first.
 * Answers stay in English; the engine says so when it recognised another language. */
export type Lang = "en" | "fr" | "ar" | "derja";

const strip = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ًͯ-ٰٟ]/g, "").replace(/ـ/g, "")
    .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");

/* [pattern, English replacement, language]. Applied in order on the accent-stripped lowercase text. */
const MAP: [RegExp, string, Lang][] = [
  // greetings and thanks are handled by isGreeting; these keep questions like "salut, qui est aziz" working
  [/\b(salut|bonjour|bonsoir|coucou)\b/g, "hello", "fr"],
  [/\b(merci( beaucoup)?)\b/g, "thanks", "fr"],
  [/\b(aslema|asslema|ahla|3aslema)\b/g, "hello", "derja"],
  [/\b(yaatik essa7a|yaatik el 3aychek|barcha merci|saha)\b/g, "thanks", "derja"],
  [/(مرحبا|اهلا|السلام عليكم|سلام|صباح الخير|مساء الخير)/g, "hello", "ar"],
  [/(شكرا|مشكور|بارك الله فيك)/g, "thanks", "ar"],
  // who
  [/\b(qui est|qui c'est|qui es tu)\b/g, "who is", "fr"],
  [/\b(chkoun|chkoun houwa|chkoun hedha|chkon)\b/g, "who is", "derja"],
  [/(شكون|شكوون)/g, "who is", "derja"],
  [/(من هو|من هي|من يكون|عزيز من)/g, "who is", "ar"],
  // what is
  [/\b(c'est quoi|qu'est-ce que|qu'est ce que|cest quoi|ca veut dire quoi)\b/g, "what is", "fr"],
  [/\b(chnowa houwa|chnowa hiya|chnowa|chneya|chnouwa|شنو هو|شنوة)\b/g, "what is", "derja"],
  [/(ما هو|ما هي|ماهو|ماهي|ما معني|ما المقصود ب)/g, "what is", "ar"],
  // projects, work
  [/\b(pouvez-vous me parler d'|pouvez vous me parler d'|parle-moi d'|parle moi d'|peux-tu me parler d'|me parler d')/g, "tell me about ", "fr"],
  [/\b(quels sont ses projets|ses projets|projets?|realisations?)\b/g, "projects", "fr"],
  [/\b(el projets|projets mte3o|mashrou3|machari3)\b/g, "projects", "derja"],
  [/(مشاريعه|مشاريع|مشروع|اعماله)/g, "projects", "ar"],
  [/\b(realises?|a-t-il realises?|a t il realises?|ses realisations)\b/g, "built", "fr"],
  // certifications, skills
  [/\b(certifications?|certificats?|diplomes?|badges?)\b/g, "certifications", "fr"],
  [/(شهاداته|شهادات|شهادة|شهاده)/g, "certifications", "ar"],
  [/\b(competences?|outils|technologies)\b/g, "skills", "fr"],
  [/(مهاراته|مهارات|ادوات)/g, "skills", "ar"],
  [/(لغاته|لغات|اللغات|يتكلم|يتحدث)/g, "languages he speaks", "ar"],
  [/(تدريب|تدريبات|خبرته|خبرة)/g, "internship experience", "ar"],
  [/(دراسته|يدرس|جامعة|تعليم)/g, "study", "ar"],
  // internship, availability, hiring
  [/\b(stages?|stagiaire)\b/g, "internship", "fr"],
  [/\b(disponible|dispo|disponibilite)\b/g, "available", "fr"],
  [/\b(embauche|recruter|recrutement)\b/g, "hire", "fr"],
  // where, languages, studies
  [/\b(ou habite-t-il|ou habite t il|ou habite|ou vit|ou est-il base|ou est il base|ou est-il|base ou)\b/g, "where is he based", "fr"],
  [/\b(win yaskon|win ya9ed|win mawjoud|win)\b/g, "where is he based", "derja"],
  [/(وين يسكن|اين يسكن|اين يقيم|وين)/g, "where is he based", "ar"],
  [/\b(quelles langues parle-t-il|quelles langues parle t il|langues? parle(es)?|parle-t-il|parle t il)\b/g, "languages he speaks", "fr"],
  [/\b(etudes?|etudie|ecole)\b/g, "study", "fr"],
  [/\b(doctorat|these)\b/g, "phd", "fr"],
  [/\b(experience professionnelle|parcours)\b/g, "experience", "fr"],
  // misc function words that would otherwise count as unknown content
  [/\b(peut-on|peut on|voir|montre-moi|montrez-moi)\b/g, " ", "fr"],
  [/\b(a-t-il|a t il|est-il|est il|il a|il est|ses|son|sa|leur|dans|une?|des|les|le|la|quoi|pour|quels?|quelles?|fait|faits)\b/g, " ", "fr"],
  [/\b(el|elli|mte3o|mte3ou|mte3ha|mtaa|3andou|3and|ya3ni)\b/g, " ", "derja"],
];

/* Common slips and shorthand in English. */
const SHORTHAND: [RegExp, string][] = [
  [/\bwhois\b/g, "who is"], [/\b(whats|wats|wut)\b/g, "what is"], [/\bwat\b/g, "what"], [/\bur\b/g, "your"], [/\bu\b/g, "you"],
  [/\bhe's\b/g, "he is"], [/\bwhat's\b/g, "what is"], [/\bdoesnt\b/g, "does not"], [/\bdont\b/g, "do not"], [/\bpls\b/g, "please"], [/\bppl\b/g, "people"],
];

export interface Normalised { text: string; lang: Lang; raw: string }

export function normalise(raw: string): Normalised {
  let t = strip(raw);
  const seen = new Set<Lang>();
  for (const [re, to, l] of MAP) {
    re.lastIndex = 0;
    if (re.test(t)) { if (to.trim()) seen.add(l); re.lastIndex = 0; t = t.replace(re, to); }
    re.lastIndex = 0;
  }
  for (const [re, to] of SHORTHAND) t = t.replace(re, to);
  const lang: Lang = seen.has("derja") ? "derja" : seen.has("ar") || /[\u0600-\u06ff]/.test(raw) ? "ar" : seen.has("fr") ? "fr" : "en";
  return { text: t.replace(/\s+/g, " ").trim(), lang, raw };
}

/* Greeting, thanks and goodbye words in every supported language. A message made only of these is small talk. */
const HELLO = ["hi", "hello", "hey", "hiya", "heya", "yo", "sup", "howdy", "greetings", "good morning", "good afternoon", "good evening", "morning", "evening", "hello", "salut", "bonjour", "bonsoir", "coucou", "aslema", "ahla", "salam", "welcome"];
const PHRASES = ["what is up", "whats up", "how are you", "how are you doing", "how is it going", "how r u", "ca va", "comment ca va", "labes", "kifech halek", "are you there", "you there", "anyone there", "nice work", "good job", "well done", "great job", "great work", "good work", "bravo", "for the help", "for your help", "for helping", "for that", "for the answers", "so much"];
const FILL = ["there", "friend", "buddy", "bot", "guys", "all", "everyone", "again", "mate", "dear", "sir", "madam", "please", "team"];
const THANKS = ["thanks", "thank you", "thank", "thx", "ty", "cheers", "merci", "shukran", "great", "awesome", "nice", "cool", "perfect", "good", "ok", "okay", "k", "lol", "haha", "hehe", "wow", "yes", "yeah", "yep", "no", "nope", "sure", "fine", "alright", "a lot", "so much", "much", "very much", "beaucoup", "barcha", "saha"];
const BYE = ["bye", "goodbye", "see you", "later", "cya", "au revoir", "a bientot", "bslama", "ciao", "good night", "night"];

/** A leading greeting before a real question ("bonjour, pouvez-vous...") is dropped so the question can be routed. */
export function stripGreeting(text: string): string {
  const m = text.match(/^(hello|hi|hey|yo|hiya|good (morning|afternoon|evening)|salut|bonjour|bonsoir|coucou|aslema|ahla|salam)[\s,!.:-]+(.{6,})$/);
  return m ? m[3] : text;
}

export type Smalltalk = "hello" | "thanks" | "bye" | null;
export function smalltalk(text: string): Smalltalk {
  const t = strip(text).replace(/[^a-z0-9؀-ۿ ]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const all = [...HELLO, ...THANKS, ...BYE, ...FILL, ...PHRASES].sort((a, b) => b.length - a.length);
  let rest = ` ${t} `;
  for (const w of all) rest = rest.split(` ${w} `).join("  ");
  if (rest.trim() !== "") return null;
  const has = (list: string[]) => list.some((w) => ` ${t} `.includes(` ${w} `));
  return has(BYE) ? "bye" : has(HELLO) ? "hello" : "thanks";
}
