import { useState } from 'react';

import { useLanguage, useT } from '../i18n/index.js';
import { Owl } from '../layouts/AuthLayout.jsx';
import { MessageBubble } from '../pages/tutor/TutorPage.jsx';
import { useTutorChat } from '../tutor/useTutorChat.js';

const PROMPTS = [
  { en: 'Explain simply', km: 'ពន្យល់ដោយសាមញ្ញ' },
  { en: 'Give an example', km: 'ផ្តល់ឧទាហរណ៍' },
  { en: 'Quiz me', km: 'សាកល្បងខ្ញុំ' },
];

export const TutorDrawer = ({ defaultOpen = true, subject, kitId }) => {
  const t = useT();
  const { language } = useLanguage();
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState('');
  const { messages, quota, suggestions, send, retry } = useTutorChat(kitId, language);
  const submit = (event) => { event.preventDefault(); const content = draft; setDraft(''); void send(content); };

  return <section className="sticky bottom-0 z-10 rounded-t-[1.5rem] bg-tint-100/95 px-5 pb-5 pt-3 backdrop-blur" aria-label={t('tutor.title')}>
    <span className="mx-auto block h-1.5 w-12 rounded-full bg-tint-200" aria-hidden="true" />
    <div className="mt-2 flex items-center gap-3"><Owl variant="waving" className="size-10 shrink-0" /><h2 className="flex-1 text-xl font-bold text-navy-900">{t('tutor.title')}</h2>{quota && <span className="text-xs font-semibold text-navy-600">{t('tutor.messagesRemaining', { count: quota.remaining })}</span>}<button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={t(open ? 'tutor.collapse' : 'tutor.expand')} className="grid size-9 place-items-center rounded-full text-navy-800 hover:bg-white/70"><svg viewBox="0 0 24 24" className={`size-5 transition-transform ${open ? '' : 'rotate-180'}`} fill="none" aria-hidden="true"><path d="m6 15 6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></button></div>
    {open && <div className="mt-3"><div className="max-h-72 space-y-3 overflow-y-auto">{messages.slice(-6).map((message) => <MessageBubble key={message.id} message={message} t={t} onRetry={() => retry(message.id)} />)}{messages.length === 0 && <p className="rounded-2xl bg-white px-4 py-3 text-base leading-relaxed text-navy-900">{t('tutor.whatToUnderstand')}</p>}</div><ul className="mt-3 flex flex-wrap gap-2">{(suggestions.length ? suggestions : PROMPTS.map((prompt) => language === 'km' ? prompt.km : prompt.en)).map((prompt) => <li key={prompt}><button type="button" onClick={() => setDraft(prompt)} className="rounded-full border border-tint-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-800">{prompt}</button></li>)}</ul><form className="mt-3 flex items-center gap-2 rounded-full bg-white p-2 ring-1 ring-tint-200" onSubmit={submit}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('tutor.askAbout', { subject })} aria-label={t('tutor.askAbout', { subject })} className="min-w-0 flex-1 bg-transparent px-3 text-base text-navy-900 placeholder:text-navy-600/60 focus:outline-none" /><button type="submit" disabled={!draft.trim()} aria-label={t('tutor.send')} className="grid size-11 shrink-0 place-items-center rounded-full bg-navy-800 text-white disabled:opacity-50"><svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z" /></svg></button></form></div>}
  </section>;
};
