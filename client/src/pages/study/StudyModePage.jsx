import { Link, useParams } from 'react-router-dom';

import { KitsHeader, KitFolderTile } from '../../layouts/AppLayout.jsx';
import { materialCount } from '../kits/KitsPage.jsx';
import { useLanguage, useT } from '../../i18n/index.js';
import { useStudySource } from './useSourceSummaries.js';

/**
 * The ways into a material, as a 2×2 grid.
 *
 * The reference draws this as a full screen under its own header rather than
 * the centered dialog it used to be. `/study` is an immersive route, so the tab
 * bar stays hidden and the header's back arrow is the way out — to the parent
 * kit, whichever file is open.
 *
 * Opened with `?sourceId=…` (tapping one file inside a kit) the screen is about
 * that file and nothing else: the header names it, the kit drops to a subtitle,
 * and all four options carry the id onward so the summary, quiz, flashcards and
 * mock exam are each built from that file alone. Without an id it is the kit as
 * a whole, which is how the Practice tab still reaches it.
 */
export const StudyModePage = () => {
  const t = useT();
  const { language } = useLanguage();
  const { kitId = 'kit-database' } = useParams();
  const { kit, source, sourceId, missing, status } = useStudySource(kitId);

  const sourceQuery = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '';
  const kitTitle = kit ? (language === 'km' ? (kit.titleKm ?? kit.title) : kit.title) : t('kits.title');

  // With a file open the header is the file's, not the kit's — the kit stays
  // underneath it so it is still clear where the material lives.
  // Until the file list resolves the name is simply unknown — saying "file not
  // found" on first paint would accuse the kit of losing a file that is there.
  const title = sourceId ? (source?.name ?? t(missing ? 'study.fileMissingTitle' : 'common.loading')) : kitTitle;
  const meta = sourceId ? kitTitle : materialCount(t, kit?.fileCount ?? 0);

  const actions = [
    { to: `/study/${kitId}/guide${sourceQuery}`, Icon: GuideMark, label: t('kits.optionStudyGuide') },
    { to: `/quiz/${kitId}${sourceQuery}`, Icon: QuizMark, label: t('kits.optionQuiz') },
    { to: `/flashcards/${kitId}${sourceQuery}`, Icon: CardsMark, label: t('kits.optionFlashcards') },
    // The mock exam is the one option that used to leave the kit behind
    // entirely — it opened the Practice tab, which built an exam from the
    // first kit on the account. It now carries both ids, and the server draws
    // its questions only from quizzes generated off this file.
    {
      to: `/practice/setup?mock=1&kitId=${encodeURIComponent(kitId)}${sourceId ? `&sourceId=${encodeURIComponent(sourceId)}` : ''}`,
      Icon: ExamMark,
      label: t('kits.optionMockExam'),
    },
  ];

  // A material that is still processing has nothing to study yet, so every way
  // in is held shut until the server marks it ready. A selected file that is
  // not in this kit at all never opens — the old code fell through to the
  // kit's first ready file and studied that instead, under the wrong name.
  const disabled = Boolean(sourceId) && source?.status !== 'ready';

  const note = () => {
    if (missing) return t('study.fileMissing');
    if (sourceId && status === 'loading') return t('common.loading');
    if (disabled) return t('study.fileNotReady');
    if (source) return t('study.studyThisFileHint', { name: source.name });
    return t('kits.chooseStudyFirst');
  };

  return (
    <main className="min-h-dvh bg-canvas">
      <KitsHeader
        to={`/kits/${kitId}`}
        title={title}
        meta={meta}
        splitAccent={!sourceId}
        tile={sourceId ? <SourceFileTile /> : <KitFolderTile />}
      />

      <p className="px-5 pt-6 text-center text-xl font-semibold text-slate-700">{note()}</p>

      <div className="grid grid-cols-2 gap-3.5 px-5 pt-5">
        {actions.map(({ to, Icon, label }) => (
          <Link
            key={to}
            to={disabled ? '#' : to}
            onClick={(event) => {
              if (disabled) event.preventDefault();
            }}
            aria-disabled={disabled}
            className={`grid place-items-center gap-4 rounded-2xl bg-white px-4 py-8 shadow-sm ring-1 ring-tint-200/70 transition-colors ${
              disabled ? 'pointer-events-none opacity-45' : 'hover:bg-wash-50'
            }`}
          >
            <Icon />
            <span className="text-lg font-extrabold text-slate-700">{label}</span>
          </Link>
        ))}
      </div>
    </main>
  );
};

/** The header tile for a single material — a page, where a kit gets a folder. */
const SourceFileTile = () => (
  <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/25 text-white/95 shadow-sm">
    <svg viewBox="0 0 24 24" className="size-8" fill="none" aria-hidden="true">
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
        fill="currentColor"
        fillOpacity="0.55"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  </span>
);

/**
 * The four study marks, drawn from the supplied icon pack: a blue line figure
 * with one gold accent each. The blue rides `currentColor` so the tile can tint
 * it; the gold is a token, since it is the same accent the headings use.
 */
const mark = {
  viewBox: '0 0 64 64',
  className: 'size-14 text-sky-600',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 4,
  'aria-hidden': 'true',
};

const GuideMark = () => (
  <svg {...mark}>
    <path d="M32 53c-7-5-14-7-23-5V15c9-2 16 0 23 5v33Zm0 0c7-5 14-7 23-5V15c-9-2-16 0-23 5v33Z" />
    <path d="M32 20v32" />
    <path d="m32 4 2.2 5.8L40 12l-5.8 2.2L32 20l-2.2-5.8L24 12l5.8-2.2z" className="text-gold-300" fill="currentColor" stroke="none" />
  </svg>
);

const QuizMark = () => (
  <svg {...mark}>
    <rect x="10" y="8" width="38" height="48" rx="4" />
    <path d="M19 22h4m7 0h11M19 33h4m7 0h11M19 44h4m7 0h11" strokeLinecap="round" />
    <circle cx="48" cy="47" r="11" className="text-gold-300" fill="currentColor" stroke="none" />
    <path d="m43 47 4 4 7-8" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CardsMark = () => (
  <svg {...mark}>
    <rect x="13" y="17" width="34" height="25" rx="4" transform="rotate(-8 13 17)" />
    <rect x="21" y="22" width="34" height="25" rx="4" transform="rotate(8 21 22)" />
    <path d="m38 27 2.4 5.6L46 35l-5.6 2.4L38 43l-2.4-5.6L30 35l5.6-2.4z" className="text-gold-300" fill="currentColor" stroke="none" />
  </svg>
);

const ExamMark = () => (
  <svg {...mark}>
    <path d="M16 7h25l11 11v39H16z" strokeLinejoin="round" />
    <path d="M41 7v13h11M24 31h19M24 40h12" strokeLinecap="round" />
    <circle cx="48" cy="48" r="11" className="text-gold-300" fill="currentColor" stroke="none" />
    <path d="m43 48 4 4 7-8" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Line icons shared with the study tab bar and summary header. They stay here
 * because that is where they have always been imported from.
 */
const props = {
  viewBox: '0 0 24 24',
  className: 'size-6',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
};

export const DocIcon = () => (
  <svg {...props}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);

export const QuizIcon = () => (
  <svg {...props}>
    <path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
    <path d="M10 9.5a2 2 0 1 1 2 2v1M12 15v.4" />
  </svg>
);

export const TargetIcon = () => (
  <svg {...props}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.4" />
    <path d="m15 9 5-5m0 0h-3.5M20 4v3.5" />
  </svg>
);

export const CardsIcon = () => (
  <svg {...props}>
    <rect x="3" y="7" width="13" height="13" rx="2.5" />
    <path d="M8 4h10a2 2 0 0 1 2 2v10" />
  </svg>
);
