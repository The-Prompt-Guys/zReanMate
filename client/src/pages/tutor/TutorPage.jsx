import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useLanguage, useT } from '../../i18n/index.js';
import { useKits } from '../../kits/KitsContext.jsx';
import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { useTutorChat } from '../../tutor/useTutorChat.js';

export const TutorPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const { kits, getKit } = useKits();
  const [params] = useSearchParams();
  const kit = getKit(params.get('kitId')) ?? kits[0];
  const { messages, quota, suggestions, error, send, retry } = useTutorChat(kit?.id, language);
  const [draft, setDraft] = useState('');
  const submit = (event) => { event.preventDefault(); const content = draft; setDraft(''); void send(content); };
  const kitTitle = language === 'km' ? (kit?.titleKm || kit?.title) : kit?.title;

  return <main className="flex min-h-dvh flex-col">
    <NavyHeader className="shrink-0"><div className="flex items-start gap-3"><Link to={`/kits/${kit?.id}`} aria-label={t('common.back')} className="mt-1 shrink-0"><svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></Link><div className="min-w-0 flex-1"><h1 className="text-2xl font-bold leading-tight">{t('tutor.title')}</h1><p className="mt-0.5 truncate text-base text-white/75">{kitTitle}</p>{quota && <span className="mt-2 inline-flex rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">{t('tutor.messagesRemaining', { count: quota.remaining })}</span>}</div></div></NavyHeader>
    <div className="flex-1 space-y-4 px-5 py-5">
      {messages.map((message) => <MessageBubble key={message.id} message={message} t={t} onRetry={() => retry(message.id)} />)}
      {suggestions.length > 0 && <ul className="flex flex-wrap gap-2">{suggestions.map((suggestion) => <li key={suggestion}><button type="button" onClick={() => setDraft(suggestion)} className="rounded-full border border-tint-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-800">{suggestion}</button></li>)}</ul>}
      {messages.length === 0 && <p className="flex items-center gap-2 rounded-full bg-tint-100 px-4 py-3 text-sm text-navy-600"><SparkleIcon />{t('tutor.tryAsking')}</p>}
      {error?.code === 'quota_exceeded' && <Link to="/onboarding/plan" className="inline-block font-bold text-navy-800 underline">{t('tutor.upgrade')}</Link>}
    </div>
    <form className="sticky bottom-0 flex items-center gap-2 bg-canvas/95 px-5 pb-5 pt-2 backdrop-blur" onSubmit={submit}><div className="flex min-w-0 flex-1 items-center rounded-full bg-white p-2 ring-1 ring-tint-200"><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('tutor.placeholder')} aria-label={t('tutor.placeholder')} className="min-w-0 flex-1 bg-transparent px-3 text-base text-navy-900 placeholder:text-navy-600/60 focus:outline-none" /></div><button type="submit" disabled={!draft.trim()} aria-label={t('tutor.send')} className="grid size-12 shrink-0 place-items-center rounded-full bg-navy-800 text-white disabled:opacity-50"><svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z" /></svg></button></form>
  </main>;
};

export const MessageBubble = ({ message, t, onRetry }) => {
  const isUser = message.role === 'user';
  return <div className={isUser ? 'flex justify-end' : 'flex items-start gap-2'}>{!isUser && <OwlAvatar />}<div className="max-w-[80%]"><div className={`rounded-2xl px-4 py-3 ${isUser ? 'bg-navy-800 font-semibold text-white' : 'bg-tint-100 text-navy-900'}`}><p className="whitespace-pre-wrap leading-relaxed">{message.content || (message.status === 'failed' ? t('tutor.failed') : t('tutor.thinking'))}</p>{message.citations?.map((citation) => <span key={`${citation.sourceTitle}-${citation.pageNumber}-${citation.startSeconds}`} className="mt-2 me-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-navy-700">{t('tutor.source', { title: citation.sourceTitle })}{citation.pageNumber ? ` · ${t('tutor.page', { page: citation.pageNumber })}` : ''}</span>)}</div>{message.status === 'failed' && <button type="button" onClick={onRetry} className="mt-1 text-sm font-bold text-navy-700 underline">{t('tutor.retry')}</button>}</div></div>;
};

export const OwlAvatar = ({ className = 'size-9' }) => <span className={`grid ${className} shrink-0 place-items-center rounded-full bg-tint-200`}><svg viewBox="0 0 24 24" className="size-5 text-navy-800" fill="none" aria-hidden="true"><path d="M4 9a8 8 0 0 1 16 0v5a8 8 0 0 1-16 0z" stroke="currentColor" strokeWidth="1.8" /><circle cx="9" cy="11" r="2.4" fill="currentColor" /><circle cx="15" cy="11" r="2.4" fill="currentColor" /><path d="m12 14 1.4 1.4h-2.8z" fill="currentColor" /></svg></span>;
const SparkleIcon = () => <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="currentColor" aria-hidden="true"><path d="m12 3 1.8 4.6L18.4 9.4 13.8 11.2 12 15.8 10.2 11.2 5.6 9.4l4.6-1.8z" /></svg>;
