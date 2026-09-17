import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Markdown } from '../../components/Markdown.jsx';
import { StudyTabBar } from '../../components/StudyTabBar.jsx';
import { useLanguage, useT } from '../../i18n/index.js';
import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { api, toFormError } from '../../lib/api.js';
import { useStudySource } from './useSourceSummaries.js';

/**
 * The Study Guide — one document, taught as modules.
 *
 * Not a summary screen. Each module is a card that teaches one concept in four
 * fixed parts: the core principles, one worked application, the pitfalls around
 * it, and a recall check whose answer stays hidden until the student commits to
 * one. That last part is the whole point — a guide you can read without ever
 * being asked anything is a summary with extra steps.
 *
 * Everything is written to be skimmed: short bullets, one example, black text on
 * white. A module a student scrolls past is a module they did not learn.
 *
 * The four headings are written here from the dictionaries, never by the model,
 * so a Khmer guide is Khmer down to the section labels.
 *
 * Scoped to one file: `useStudySource` resolves `?sourceId=` and nothing is
 * requested without it, so the guide covers the material the student opened and
 * no sibling file from the same kit.
 */
export const StudyGuidePage = () => {
  const t = useT();
  const { language } = useLanguage();
  const { kitId } = useParams();
  const { kit, source, sourceId, missing } = useStudySource(kitId);
  const [guide, setGuide] = useState(null);
  const [error, setError] = useState(null);

  const kitTitle = language === 'km' ? (kit?.titleKm || kit?.title) : kit?.title;
  const title = sourceId ? (source?.name ?? t('common.loading')) : (source?.name ?? kitTitle);

  // Pulled out of `source` so the callback is keyed on the two fields it
  // actually reads — a new object identity for the same file must not restart
  // the poll.
  const activeSourceId = source?.id;
  const activeStatus = source?.status;

  const refresh = useCallback(async () => {
    if (!activeSourceId || activeStatus !== 'ready') return;
    try {
      const { data } = await api.post(`/sources/${activeSourceId}/study-guide`, { language });
      setGuide(data);
      setError(null);
    } catch (err) {
      setError(toFormError(err));
    }
  }, [activeSourceId, activeStatus, language]);

  useEffect(() => { refresh(); }, [refresh]);

  // Modules land one at a time, so the screen fills as they are written rather
  // than sitting blank until the last one. Polling stops the moment the server
  // says the whole guide is settled.
  const settled = guide?.status === 'ready' || guide?.status === 'failed';
  useEffect(() => {
    if (!activeSourceId || settled) return undefined;
    const timer = window.setInterval(refresh, 1500);
    return () => window.clearInterval(timer);
  }, [activeSourceId, settled, refresh]);

  const modules = guide?.modules ?? [];
  const ready = modules.filter((item) => item.status === 'ready');
  const percent = modules.length ? Math.round((ready.length / modules.length) * 100) : 0;

  const header = (
    <NavyHeader>
      <div className="flex items-start gap-3">
        <Link to={`/kits/${kitId}`} aria-label={t('common.back')} className="mt-1 shrink-0">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
            <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold leading-tight">{title}</h1>
          <p className="mt-0.5 truncate text-base text-white/75">{kitTitle}</p>
        </div>
      </div>
    </NavyHeader>
  );

  if (missing) {
    return (
      <main>
        {header}
        <div className="px-5 py-10 text-center">
          <p className="text-base font-medium text-ink-600">{t('study.fileMissing')}</p>
          <Link to={`/kits/${kitId}`} className="mt-4 inline-block font-semibold text-navy-800">
            {t('quiz.backToKit')}
          </Link>
        </div>
      </main>
    );
  }

  // Nothing has been extracted yet, so there is nothing to teach from.
  if (source && source.status !== 'ready') {
    return (
      <main>
        {header}
        <div className="px-5 py-10 text-center">
          <p className="text-base font-bold text-ink-900">{t('guide.waitingForFile')}</p>
          <p className="mt-2 text-sm text-ink-600">{source.name}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col">
      {header}

      <div className="flex-1 px-5 pt-5">
        <p className="text-sm font-bold uppercase tracking-wide text-ink-600">{t('guide.label')}</p>
        <h2 className="mt-1 text-3xl font-bold text-ink-900">{t('guide.heading')}</h2>
        <p className="mt-1 text-base text-ink-600">{t('guide.subtitle')}</p>

        {error && <p className="mt-4 text-sm text-danger-600">{t('guide.loadFailed')}</p>}

        {/* While modules are still being written the bar counts the ones that
            are readable, not an invented percentage. */}
        {modules.length > 0 && !settled && (
          <div className="mt-5">
            <p className="text-base text-ink-900">
              {t('guide.progress', { done: ready.length, total: modules.length })}
            </p>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-tint-100">
              <span className="block h-full rounded-full bg-navy-600 transition-[width]" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )}

        {modules.length === 0 && !error && (
          <p className="mt-6 text-base font-medium text-ink-600">{t('guide.generating')}</p>
        )}

        <div className="mt-5 space-y-4 pb-6">
          {modules.map((module) => (
            <ModuleCard key={module.index} module={module} />
          ))}
        </div>
      </div>

      <StudyTabBar kitId={kitId} sourceId={sourceId} active="learn" />
    </main>
  );
};

/** One concept: four labelled sections and a recall check. */
const ModuleCard = ({ module }) => {
  const t = useT();

  if (module.status !== 'ready') {
    return (
      <article className="rounded-card bg-white p-5 shadow-sm ring-1 ring-tint-200/70">
        <h3 className="text-xl font-bold text-ink-900">
          {t('guide.moduleHeading', { number: module.index, title: module.title })}
        </h3>
        <p className="mt-2 text-sm font-medium text-ink-600">
          {t(module.status === 'failed' ? 'guide.moduleFailed' : 'guide.moduleGenerating')}
        </p>
      </article>
    );
  }

  return (
    <article className="rounded-card bg-white p-5 shadow-sm ring-1 ring-tint-200/70">
      {/* One heading, numbered in place: "Module 3: Contribution Margin". The
          number and the concept belong to the same line — split across an
          eyebrow and a title they read as two separate things. */}
      <h3 className="text-2xl font-bold leading-tight text-ink-900">
        {t('guide.moduleHeading', { number: module.index, title: module.title })}
      </h3>

      <Section label={t('guide.sectionExplanation')} body={module.explanationMd} />
      <Section label={t('guide.sectionApplication')} body={module.applicationMd} />
      <Section label={t('guide.sectionPitfalls')} body={module.pitfallsMd} />

      {module.recall?.length > 0 && (
        <section className="mt-5 rounded-2xl bg-tint-100/70 p-4">
          <h4 className="text-base font-extrabold text-ink-900">{t('guide.sectionRecall')}</h4>
          <ul className="mt-3 space-y-3">
            {module.recall.map((check) => (
              <li key={check.question}>
                <p className="font-bold text-ink-900">{check.question}</p>
                {/*
                  A real <details>, not a toggle built out of state: it is
                  keyboard-operable and screen-reader-announced for free, it
                  survives a re-render when the next module lands mid-read, and
                  the browser's own find-in-page can open it.
                */}
                <details className="group mt-2">
                  <summary className="cursor-pointer list-none text-sm font-bold text-ink-900 underline underline-offset-4 marker:content-none">
                    <span className="group-open:hidden">{t('guide.revealAnswer')}</span>
                    <span className="hidden group-open:inline">{t('guide.hideAnswer')}</span>
                  </summary>
                  <div className="mt-2 text-base leading-relaxed text-ink-900">
                    <Markdown source={check.answer} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
};

/** One of the three teaching sections. The label is ours; the body is the model's. */
const Section = ({ label, body }) => {
  if (!body) return null;
  return (
    <section className="mt-5">
      <h4 className="text-base font-extrabold text-ink-900">{label}</h4>
      <div className="mt-2 text-base leading-relaxed text-ink-900">
        <Markdown source={body} />
      </div>
    </section>
  );
};
