import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useLanguage, useT } from '../../i18n/index.js';
import { useKits } from '../../kits/KitsContext.jsx';
import { api } from '../../lib/api.js';
import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { MessageBubble, OwlAvatar } from '../tutor/TutorPage.jsx';
import { useTutorChat } from '../../tutor/useTutorChat.js';

/** The account-wide assistant uses the first kit as the AI context. */
export const AssistantScreen = () => {
  const t = useT();
  const { language } = useLanguage();
  const location = useLocation();
  const explainRequest = location.state?.assistantExplain;
  const temporary = Boolean(explainRequest);
  const { kits, status, getFiles, loadFiles } = useKits();
  const [kitId, setKitId] = useState(() => explainRequest?.kitId ?? '');
  const [sourceId, setSourceId] = useState(() => explainRequest?.sourceId ?? '');
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [oneOffMessages, setOneOffMessages] = useState([]);
  const kit = kits.find((item) => item.id === kitId) ?? kits[0];
  const files = kit ? getFiles(kit.id) : [];
  const source = files.find((file) => file.id === sourceId);
  const { messages, error, send, retry } = useTutorChat(kit?.id, language, source?.id ?? null, { enabled: !temporary });
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef(null);
  const explainRequestRef = useRef(null);

  const refreshHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/chat/history', { params: { language } });
      setHistory(data.conversations ?? []);
    } catch {
      setHistory([]);
    }
  }, [language]);

  useEffect(() => { if (!temporary) void refreshHistory(); }, [refreshHistory, temporary]);

  useEffect(() => {
    if (!kit?.id) return;
    setKitId((current) => current || kit.id);
    setSourceId((current) => current || (kit.id === explainRequest?.kitId ? explainRequest.sourceId ?? '' : ''));
    loadFiles(kit.id).catch(() => {});
  }, [kit?.id, loadFiles, explainRequest]);

  const sendOneOff = useCallback(async (content) => {
    const requestId = `one-off-${Date.now()}-${Math.random()}`;
    setOneOffMessages((current) => [...current, { id: `${requestId}-user`, role: 'user', content, status: 'complete', citations: [] }]);
    try {
      const { data } = await api.post('/chat/explain', {
        kitId: kit?.id,
        sourceId: source?.id || explainRequest?.sourceId || undefined,
        content,
        language,
      });
      setOneOffMessages((current) => [...current, { id: `${requestId}-assistant`, role: 'assistant', content: data.content, status: 'complete', citations: data.citations ?? [] }]);
    } catch {
      setOneOffMessages((current) => [...current, { id: `${requestId}-assistant`, role: 'assistant', content: t('assistant.connectionError'), status: 'failed', citations: [] }]);
    }
  }, [explainRequest?.sourceId, kit?.id, language, source?.id, t]);

  useEffect(() => {
    if (!explainRequest?.kitId || kit?.id !== explainRequest.kitId || explainRequestRef.current === explainRequest) return;
    explainRequestRef.current = explainRequest;
    const content = [
      `Please explain this question clearly: ${explainRequest.prompt}`,
      explainRequest.selectedAnswer ? `My answer: ${explainRequest.selectedAnswer}` : '',
      `Correct answer: ${explainRequest.correctAnswer}`,
      `Existing explanation: ${explainRequest.explanation}`,
    ].filter(Boolean).join('\n');
    void sendOneOff(content);
  }, [explainRequest, kit?.id, sendOneOff]);

  useEffect(() => {
    if (sourceId && !source) setSourceId('');
  }, [source, sourceId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, oneOffMessages]);

  const submit = (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !kit) return;
    setDraft('');
    void (temporary ? sendOneOff(content) : send(content));
  };

  const openHistory = async (conversation) => {
    setHistoryOpen(false);
    setKitId(conversation.kitId);
    setSourceId(conversation.sourceId ?? '');
    await loadFiles(conversation.kitId).catch(() => {});
  };

  return (
    <main className="relative flex h-[calc(100dvh-6rem)] min-h-0 flex-col overflow-hidden">
      <NavyHeader className="shrink-0">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">{t('assistant.title')}</h1>
          <Owl variant="default" className="size-20 shrink-0" />
        </div>
      </NavyHeader>

      <div className="flex items-center gap-3 border-b border-tint-200 bg-white px-5 py-3">
        {!temporary && <button
          type="button"
          onClick={() => { setHistoryOpen((open) => !open); void refreshHistory(); }}
          aria-expanded={historyOpen}
          aria-label={t('assistant.history')}
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-tint-200 bg-canvas text-navy-800 hover:bg-tint-100"
        >
          <HistoryIcon />
        </button>}
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t('assistant.chooseKit')}</span>
          <select
            value={kit?.id ?? ''}
            onChange={(event) => { setKitId(event.target.value); setSourceId(''); }}
            className="w-full rounded-xl border border-tint-200 bg-canvas px-3 py-2.5 text-sm font-semibold text-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-800/20"
            aria-label={t('assistant.chooseKit')}
          >
            <option value="">{t('assistant.chooseKit')}</option>
            {kits.map((item) => <option key={item.id} value={item.id}>{language === 'km' ? (item.titleKm || item.title) : item.title}</option>)}
          </select>
        </label>
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t('assistant.chooseFile')}</span>
          <select
            value={source?.id ?? ''}
            onChange={(event) => setSourceId(event.target.value)}
            disabled={!kit || files.length === 0}
            className="w-full rounded-xl border border-tint-200 bg-canvas px-3 py-2.5 text-sm font-semibold text-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-800/20 disabled:opacity-50"
            aria-label={t('assistant.chooseFile')}
          >
            <option value="">{t('assistant.allFiles')}</option>
            {files.map((file) => <option key={file.id} value={file.id}>{file.name}</option>)}
          </select>
        </label>
      </div>

      {historyOpen && (
        <section className="absolute left-4 right-4 top-[8.5rem] z-20 max-h-[55%] overflow-y-auto rounded-2xl bg-white p-3 shadow-xl ring-1 ring-tint-200" aria-label={t('assistant.history')}>
          <div className="mb-2 flex items-center justify-between px-2">
            <h2 className="font-bold text-navy-900">{t('assistant.history')}</h2>
            <button type="button" onClick={() => setHistoryOpen(false)} aria-label={t('assistant.closeHistory')} className="text-2xl leading-none text-navy-700">×</button>
          </div>
          {history.length === 0 ? (
            <p className="px-2 py-4 text-sm text-ink-600">{t('assistant.noHistory')}</p>
          ) : (
            <ul className="space-y-2">
              {history.map((conversation) => {
                const sourceTitle = conversation.sourceTitle ?? t('assistant.allFiles');
                return (
                  <li key={conversation.id}>
                    <button type="button" onClick={() => openHistory(conversation)} className="w-full rounded-xl bg-canvas px-3 py-2.5 text-left hover:bg-tint-100">
                      <span className="block truncate text-sm font-bold text-navy-900">{t('assistant.conversationFrom', { kit: conversation.kitTitle, source: sourceTitle })}</span>
                      <span className="mt-1 block truncate text-sm text-navy-700">{conversation.preview}</span>
                      <time className="mt-1 block text-xs text-navy-600" dateTime={conversation.lastMessageAt}>{new Intl.DateTimeFormat(language === 'km' ? 'km-KH' : 'en-US', { month: 'short', day: 'numeric' }).format(new Date(conversation.lastMessageAt))}</time>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-32 pt-5">
        {oneOffMessages.map((message) => <MessageBubble key={message.id} message={message} t={(key, params) => (key === 'tutor.thinking' ? t('assistant.thinking') : key === 'tutor.failed' ? t('assistant.failed') : t(key, params))} />)}
        {!temporary && messages.length === 0 && status === 'ready' && (
          <div className="flex items-start gap-2">
            <OwlAvatar />
            <p className="max-w-[80%] rounded-2xl bg-tint-100 px-4 py-3 leading-relaxed text-navy-900">
              {kit ? t('assistant.welcome') : t('assistant.noMaterials')}
            </p>
          </div>
        )}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            t={(key, params) => (key === 'tutor.thinking' ? t('assistant.thinking') : key === 'tutor.failed' ? t('assistant.failed') : t(key, params))}
            onRetry={() => retry(message.id)}
          />
        ))}
        {error && error.code !== 'quota_exceeded' && (
          <p className="text-center text-sm font-semibold text-red-700">{error.message || t('assistant.connectionError')}</p>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="fixed bottom-[4.5rem] left-1/2 z-10 flex w-full max-w-[26rem] -translate-x-1/2 items-center gap-2 bg-canvas/95 px-5 pb-3 pt-2 backdrop-blur" onSubmit={submit}>
        <div className="flex min-w-0 flex-1 items-center rounded-full bg-white p-2 ring-1 ring-tint-200">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('assistant.placeholder')}
            aria-label={t('assistant.placeholder')}
            className="min-w-0 flex-1 bg-transparent px-3 text-base text-navy-900 placeholder:text-navy-600/60 focus:outline-none"
            disabled={!kit}
          />
        </div>
        <button
          type="submit"
          disabled={!draft.trim() || !kit}
          aria-label={t('assistant.send')}
          className="grid size-12 shrink-0 place-items-center rounded-full bg-navy-800 text-white disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z" /></svg>
        </button>
      </form>
    </main>
  );
};

const HistoryIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);