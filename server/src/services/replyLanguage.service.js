const KHMER_SCRIPT = /[\u1780-\u17ff\u19e0-\u19ff]/;
const KHMER_REQUEST = /(?:\b(?:in|into|using|use|speak|answer|explain|translate|respond|reply|write)\b[\s\S]{0,40}\b(?:khmer|cambodian)\b|\b(?:khmer|cambodian)\b[\s\S]{0,40}\b(?:explain|answer|respond|reply|translate|write)\b)/i;

/** Lets a single request choose its reply language without changing the UI language. */
export const detectRequestedReplyLanguage = (text, fallback = 'en') => {
  const value = String(text ?? '');
  if (KHMER_SCRIPT.test(value) || KHMER_REQUEST.test(value) || value.includes('ខ្មែរ')) return 'km';
  return fallback;
};