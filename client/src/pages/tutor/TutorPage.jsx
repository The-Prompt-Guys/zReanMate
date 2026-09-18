import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Markdown } from '../../components/Markdown.jsx';
import { useLanguage, useT } from '../../i18n/index.js';
import { useKits } from '../../kits/KitsContext.jsx';
import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { useTutorChat } from '../../tutor/useTutorChat.js';

/**
 * The tutor, pointed at one material.
 *
 * `?sourceId=` names the file the thread is about, and the header carries the
 * picker for it. Without one the tutor answers from the whole kit, which is
 * what it used to do always — and why a question about a PyQt6 chapter could
 * come back explaining fractional reserve banking, cited to a file the student
 * had not opened.
 *
 * The message quota used to sit where the picker now is. It has not been
 * dropped, only demoted: it appears above the composer once it is nearly spent,
 * which is the only point at which it changes what the student does.
 */
export const TutorPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const { kits, getKit, getFiles, loadFiles } = useKits();
  const [params] = useSearchParams();
  const kit = getKit(params.get('kitId')) ?? kits[0];
  const sourceId = params.get('sourceId');
  const { messages, quota, suggestions, error, send, retry } = useTutorChat(kit?.id, language, sourceId);
  const [draft, setDraft] = useState('');
  const submit = (event) => { event.preventDefault(); const content = draft; setDraft(''); void send(content); };
  const kitTitle = language === 'km' ? (kit?.titleKm || kit?.title) : kit?.title;

  useEffect(() => { if (kit?.id) loadFiles(kit.id).catch(() => {}); }, [kit?.id, loadFiles]);
  const files = kit?.id ? getFiles(kit.id) : [];
  const source = sourceId ? files.find((file) => file.id === sourceId) : null;

  // Only worth a line when it is nearly gone; a full allowance is noise.
  const quotaLow = quota && quota.limit !== null && quota.remaining <= 5;

  return <main className="flex min-h-dvh flex-col">
    <NavyHeader className="shrink-0"><div className="flex items-start gap-3"><Link to={`/kits/${kit?.id}`} aria-label={t('common.back')} className="mt-1 shrink-0"><svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></Link><div className="min-w-0 flex-1"><h1 className="text-2xl font-bold leading-tight">{t('tutor.title')}</h1><p className="mt-0.5 truncate text-base text-white/75">{kitTitle}</p><Link to={`/tutor/source?kitId=${encodeURIComponent(kit?.id ?? '')}${sourceId ? `&sourceId=${encodeURIComponent(sourceId)}` : ''}`} className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-white/25"><FileMark /><span className="truncate">{source?.name ?? t('tutor.allMaterials')}</span><ChevronDownIcon /></Link></div></div></NavyHeader>
    <div className="flex-1 space-y-4 px-5 py-5">
      {messages.map((message) => <MessageBubble key={message.id} message={message} t={t} onRetry={() => retry(message.id)} />)}
      {suggestions.length > 0 && <ul className="flex flex-wrap gap-2">{suggestions.map((suggestion) => <li key={suggestion}><button type="button" onClick={() => setDraft(suggestion)} className="rounded-full border border-tint-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-800">{suggestion}</button></li>)}</ul>}
      {messages.length === 0 && <p className="flex items-center gap-2 rounded-full bg-tint-100 px-4 py-3 text-sm text-navy-600"><SparkleIcon />{t('tutor.tryAsking')}</p>}
      {error?.code === 'quota_exceeded' && <Link to="/" className="inline-block font-bold text-navy-800 underline">{t('tutor.upgrade')}</Link>}
    </div>
    {quotaLow && <p className="px-5 text-center text-sm font-semibold text-ink-600">{t('tutor.messagesRemaining', { count: quota.remaining })}</p>}
    <form className="sticky bottom-0 flex items-center gap-2 bg-canvas/95 px-5 pb-5 pt-2 backdrop-blur" onSubmit={submit}><div className="flex min-w-0 flex-1 items-center rounded-full bg-white p-2 ring-1 ring-tint-200"><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('tutor.placeholder')} aria-label={t('tutor.placeholder')} className="min-w-0 flex-1 bg-transparent px-3 text-base text-navy-900 placeholder:text-navy-600/60 focus:outline-none" /></div><button type="submit" disabled={!draft.trim()} aria-label={t('tutor.send')} className="grid size-12 shrink-0 place-items-center rounded-full bg-navy-800 text-white disabled:opacity-50"><svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z" /></svg></button></form>
  </main>;
};

export const MessageBubble = ({ message, t, onRetry }) => {
  const isUser = message.role === 'user';
  const content = message.content || (message.status === 'failed' ? t('tutor.failed') : t('tutor.thinking'));
  return <div className={isUser ? 'flex justify-end' : 'flex min-w-0 items-start gap-2'}>{!isUser && <OwlAvatar />}<div className="min-w-0 max-w-[80%]"><div className={`min-w-0 rounded-2xl px-4 py-3 ${isUser ? 'bg-navy-800 font-semibold text-white' : 'bg-tint-100 text-black'}`}>{isUser ? <p className="whitespace-pre-wrap break-words leading-relaxed">{content}</p> : <Markdown source={content} className="break-words leading-relaxed" />}{message.citations?.map((citation) => <span key={`${citation.sourceTitle}-${citation.pageNumber}-${citation.startSeconds}`} className="mt-2 me-2 inline-flex max-w-full whitespace-normal break-all rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">{t('tutor.source', { title: citation.sourceTitle })}{citation.pageNumber ? ` · ${t('tutor.page', { page: citation.pageNumber })}` : ''}</span>)}</div>{message.status === 'failed' && <button type="button" onClick={onRetry} className="mt-1 text-sm font-bold text-navy-700 underline">{t('tutor.retry')}</button>}</div></div>;
};

export const OwlAvatar = ({ className = 'size-9' }) => <span className={`grid ${className} shrink-0 place-items-center overflow-hidden rounded-full bg-tint-200`}><img src="/brand/reanmate-owl-logo-default.png" alt="" aria-hidden="true" className="size-full object-contain" /></span>;
const SparkleIcon = () => <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="currentColor" aria-hidden="true"><path d="m12 3 1.8 4.6L18.4 9.4 13.8 11.2 12 15.8 10.2 11.2 5.6 9.4l4.6-1.8z" /></svg>;

const FileMark = () => <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" /><path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" /></svg>;
const ChevronDownIcon = () => <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" aria-hidden="true"><path d="m6 9.5 6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
