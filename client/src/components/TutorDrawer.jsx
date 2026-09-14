import { useState } from 'react';

import { Owl } from '../layouts/AuthLayout.jsx';
import { useLanguage, useT } from '../i18n/index.js';

/**
 * docs/screens/05-ai-tutor-chat/02-collapsible-ai-tutor-drawer.
 *
 * A collapsible tutor panel pinned to the bottom of a reading screen — it is
 * part of the summary page in the design, not a route of its own, so it takes
 * `defaultOpen` and manages its own state.
 */
const PROMPTS = [
  { en: 'Explain simply', km: 'ពន្យល់ដោយសាមញ្ញ' },
  { en: 'Give an example', km: 'ផ្តល់ឧទាហរណ៍' },
  { en: 'Quiz me', km: 'សាកល្បងខ្ញុំ' },
];

export const TutorDrawer = ({ defaultOpen = true, subject }) => {
  const t = useT();
  const { language } = useLanguage();
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState('');

  return (
    <section
      className="sticky bottom-0 z-10 rounded-t-[1.5rem] bg-tint-100/95 px-5 pb-5 pt-3 backdrop-blur"
      aria-label={t('tutor.title')}
    >
      <span className="mx-auto block h-1.5 w-12 rounded-full bg-tint-200" aria-hidden="true" />

      <div className="mt-2 flex items-center gap-3">
        <Owl variant="waving" className="size-10 shrink-0" />
        <h2 className="flex-1 text-xl font-bold text-navy-900">{t('tutor.title')}</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={t(open ? 'tutor.collapse' : 'tutor.expand')}
          className="grid size-9 place-items-center rounded-full text-navy-800 hover:bg-white/70"
        >
          <svg
            viewBox="0 0 24 24"
            className={`size-5 transition-transform ${open ? '' : 'rotate-180'}`}
            fill="none"
            aria-hidden="true"
          >
            <path d="m6 15 6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="mt-3">
          <p className="rounded-2xl bg-white px-4 py-3 text-base leading-relaxed text-navy-900">
            {t('tutor.whatToUnderstand')}
          </p>

          <ul className="mt-3 flex flex-wrap gap-2">
            {PROMPTS.map((prompt) => (
              <li key={prompt.en}>
                <button
                  type="button"
                  onClick={() => setDraft(language === 'km' ? prompt.km : prompt.en)}
                  className="rounded-full border border-tint-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-800"
                >
                  {language === 'km' ? prompt.km : prompt.en}
                </button>
              </li>
            ))}
          </ul>

          <form
            className="mt-3 flex items-center gap-2 rounded-full bg-white p-2 ring-1 ring-tint-200"
            onSubmit={(event) => event.preventDefault()}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t('tutor.askAbout', { subject })}
              aria-label={t('tutor.askAbout', { subject })}
              className="min-w-0 flex-1 bg-transparent px-3 text-base text-navy-900 placeholder:text-navy-600/60 focus:outline-none"
            />
            <button
              type="submit"
              aria-label={t('tutor.send')}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-navy-800 text-white"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
                <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </section>
  );
};
