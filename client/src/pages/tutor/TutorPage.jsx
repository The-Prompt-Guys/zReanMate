import { useState } from 'react';
import { Link } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { chatMessages, chatSuggestions, kitDetailFiles, kits } from '../../mock/fixtures.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useLanguage, useT } from '../../i18n/index.js';

/** docs/screens/05-ai-tutor-chat/01-ai-chat-interface. */
export const TutorPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const { user } = useAuth();
  const [draft, setDraft] = useState('');

  const kit = kits[1];
  const kitTitle = language === 'km' ? kit.titleKm : kit.title;

  return (
    <main className="flex min-h-dvh flex-col">
      <NavyHeader className="shrink-0">
        <div className="flex items-start gap-3">
          <Link to={`/kits/${kit.id}`} aria-label={t('common.back')} className="mt-1 shrink-0">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
              <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-tight">{t('tutor.title')}</h1>
            <p className="mt-0.5 truncate text-base text-white/75">{kitTitle}</p>
            <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
                <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
              </svg>
              {t('tutor.usingFiles', { count: kitDetailFiles.length * 2 })}
            </span>
          </div>
        </div>
      </NavyHeader>

      <div className="flex-1 space-y-4 px-5 py-5">
        {chatMessages.map((message, index) => (
          <div key={message.id}>
            <MessageBubble message={message} language={language} t={t} />
            {/* Suggestion chips sit under the opening greeting in the design. */}
            {index === 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {chatSuggestions.map((suggestion) => (
                  <li key={suggestion.en}>
                    <button
                      type="button"
                      onClick={() => setDraft(language === 'km' ? suggestion.km : suggestion.en)}
                      className="rounded-full border border-tint-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-800"
                    >
                      {language === 'km' ? suggestion.km : suggestion.en}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        <p className="flex items-center gap-2 rounded-full bg-tint-100 px-4 py-3 text-sm text-navy-600">
          <SparkleIcon />
          {t('tutor.tryAsking')}
        </p>
      </div>

      <form
        className="sticky bottom-0 flex items-center gap-2 bg-canvas/95 px-5 pb-5 pt-2 backdrop-blur"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white p-2 ring-1 ring-tint-200">
          <button type="button" aria-label={t('assignments.uploadFile')} className="grid size-9 shrink-0 place-items-center rounded-full text-navy-700">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
              <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7.5-7.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('tutor.placeholder')}
            aria-label={t('tutor.placeholder')}
            className="min-w-0 flex-1 bg-transparent text-base text-navy-900 placeholder:text-navy-600/60 focus:outline-none"
          />
        </div>
        <button type="submit" aria-label={t('tutor.send')} className="grid size-12 shrink-0 place-items-center rounded-full bg-navy-800 text-white">
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
            <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z" />
          </svg>
        </button>
      </form>
    </main>
  );
};

export const MessageBubble = ({ message, language, t }) => {
  const isUser = message.role === 'user';
  const content = language === 'km' ? message.contentKm : message.content;

  return (
    <div className={isUser ? 'flex justify-end' : 'flex items-start gap-2'}>
      {!isUser && <OwlAvatar />}
      <div className={isUser ? 'max-w-[80%]' : 'max-w-[80%]'}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser ? 'bg-navy-800 font-semibold text-white' : 'bg-tint-100 text-navy-900'
          }`}
        >
          <p className="leading-relaxed">{content}</p>
          {message.citations?.map((citation) => (
            <p key={citation.sourceTitle} className="mt-1.5 text-sm text-navy-600">
              {t('tutor.source', { title: citation.sourceTitle })}
            </p>
          ))}
        </div>
        {message.at && (
          <p className={`mt-1 text-xs text-ink-400 ${isUser ? 'text-right' : ''}`}>{message.at}</p>
        )}
      </div>
    </div>
  );
};

export const OwlAvatar = ({ className = 'size-9' }) => (
  <span className={`grid ${className} shrink-0 place-items-center rounded-full bg-tint-200`}>
    <svg viewBox="0 0 24 24" className="size-5 text-navy-800" fill="none" aria-hidden="true">
      <path d="M4 9a8 8 0 0 1 16 0v5a8 8 0 0 1-16 0z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="11" r="2.4" fill="currentColor" />
      <circle cx="15" cy="11" r="2.4" fill="currentColor" />
      <path d="m12 14 1.4 1.4h-2.8z" fill="currentColor" />
      <path d="m5 4 2.5 2M19 4l-2.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  </span>
);

const SparkleIcon = () => (
  <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="currentColor" aria-hidden="true">
    <path d="m12 3 1.8 4.6L18.4 9.4 13.8 11.2 12 15.8 10.2 11.2 5.6 9.4l4.6-1.8z" />
    <path d="m18.5 15 .9 2.2 2.1.8-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.8z" />
  </svg>
);
