import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { BottomSheet, SheetOption } from '../../components/BottomSheet.jsx';
import { ArrowRightIcon, Button, TextField } from '../../components/ui.jsx';
import { useT } from '../../i18n/index.js';

/**
 * The four "add material" sheets, from docs/screens/03-study-kits/02, 04, 05
 * and 06. Each renders over whatever route is behind it.
 */

/** 04-add-youtube-url-popup — the chooser. */
export const AddMaterialSheet = () => {
  const t = useT();
  return (
    <BottomSheet labelledBy="add-material-title">
      <h2 id="add-material-title" className="text-2xl font-bold text-navy-900">
        {t('dashboard.addMaterial')}
      </h2>
      <p className="mt-1 text-base text-navy-600">{t('kits.addMaterialSubtitle')}</p>

      <div className="mt-5 space-y-3">
        <SheetOption
          to="/kits/new/photo"
          tone="blue"
          icon={<PhotoIcon />}
          title={t('kits.uploadPhoto')}
          description={t('kits.uploadPhotoHint')}
        />
        <SheetOption
          to="/kits/new/pdf"
          tone="violet"
          icon={<PdfIcon />}
          title={t('kits.uploadPdf')}
          description={t('kits.uploadPdfHint')}
        />
        <SheetOption
          to="/kits/new/youtube"
          tone="amber"
          icon={<PlayIcon />}
          title={t('kits.addYoutubeUrl')}
          description={t('kits.addYoutubeUrlHint')}
        />
        <SheetOption
          to="/kits/new/topic"
          tone="green"
          icon={<SparkIcon />}
          title={t('kits.enterTopic')}
          description={t('kits.enterTopicHint')}
        />
      </div>
    </BottomSheet>
  );
};

/** 05-youtube-url-entry. */
export const YouTubeUrlSheet = () => {
  const t = useT();
  const navigate = useNavigate();
  const [url, setUrl] = useState('');

  return (
    <BottomSheet closeTo="/kits/new" labelledBy="youtube-title">
      <div className="flex items-start gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700">
          <PlayIcon />
        </span>
        <div className="min-w-0">
          <h2 id="youtube-title" className="text-2xl font-bold text-navy-900">
            {t('kits.youtubeTitle')}
          </h2>
          <p className="mt-1 text-base text-navy-600">{t('kits.youtubeSubtitle')}</p>
        </div>
      </div>

      <form
        className="mt-6 space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          navigate('/kits/new/processing');
        }}
      >
        <TextField
          label={t('kits.youtubeTitle')}
          placeholder={t('kits.youtubePlaceholder')}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          type="url"
          inputMode="url"
        />
        <Button type="submit">
          {t('kits.createStudyKit')}
          <ArrowRightIcon />
        </Button>
        <p className="text-center text-sm text-ink-500">{t('kits.youtubeFootnote')}</p>
      </form>
    </BottomSheet>
  );
};

/** 06-youtube-processing — three staged bars. */
const STAGES = ['kits.stageReading', 'kits.stageFlashcards', 'kits.stagePreparing'];

export const ProcessingSheet = () => {
  const t = useT();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);

  // Runs the staged bars so the prototype shows the real behaviour rather than
  // a frozen mock, then lands on the finished kit.
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 300) {
          clearInterval(timer);
          navigate('/kits/kit-database');
          return p;
        }
        return p + 4;
      });
    }, 60);
    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <BottomSheet closeTo="/" labelledBy="processing-title">
      <div className="flex flex-col items-center text-center">
        <span className="grid size-24 place-items-center rounded-full bg-tint-100">
          <VideoIcon />
        </span>
        <h2 id="processing-title" className="mt-5 text-2xl font-bold text-navy-900">
          {t('kits.processingTitle')}
        </h2>
        <p className="mt-2 text-base text-navy-600">{t('kits.processingSubtitle')}</p>
      </div>

      <ol className="mt-7 space-y-5">
        {STAGES.map((key, i) => {
          const stageProgress = Math.max(0, Math.min(100, progress - i * 100));
          const active = stageProgress > 0;
          return (
            <li key={key}>
              <div className="flex items-center gap-3">
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                    active ? 'bg-navy-800 text-white' : 'bg-tint-200 text-white'
                  }`}
                >
                  {i + 1}
                </span>
                <span className={`font-bold ${active ? 'text-navy-900' : 'text-navy-600/70'}`}>
                  {t(key)}
                </span>
              </div>
              <div className="ms-11 mt-2 h-2 overflow-hidden rounded-full bg-tint-100">
                <span
                  className="block h-full rounded-full bg-navy-800 transition-[width] duration-100"
                  style={{ width: `${stageProgress}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-6 text-center text-sm text-ink-500">{t('kits.processingFootnote')}</p>
    </BottomSheet>
  );
};

/** 02-create-study-folder — named "Create a study kit" in the design. */
export const CreateKitSheet = () => {
  const t = useT();
  const navigate = useNavigate();
  const [name, setName] = useState('');

  return (
    <BottomSheet labelledBy="create-kit-title">
      <div className="flex flex-col items-center text-center">
        <span className="grid size-20 place-items-center rounded-2xl bg-tint-100 text-navy-800">
          <FolderPlusIcon />
        </span>
        <h2 id="create-kit-title" className="mt-5 text-2xl font-bold text-navy-900">
          {t('kits.createKitTitle')}
        </h2>
        <p className="mt-2 text-base text-navy-600">{t('kits.createKitSubtitle')}</p>
      </div>

      <form
        className="mt-6 space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          navigate('/kits/new');
        }}
      >
        <TextField
          label={t('kits.createKitTitle')}
          placeholder={t('kits.kitNamePlaceholder')}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit">
          {t('kits.createStudyKit')}
          <ArrowRightIcon />
        </Button>
        <p className="text-center text-sm text-ink-500">{t('kits.createKitFootnote')}</p>
      </form>
    </BottomSheet>
  );
};

const svg = {
  viewBox: '0 0 32 32',
  fill: 'none',
  className: 'size-8',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
};

const PhotoIcon = () => (
  <svg {...svg}>
    <rect x="4" y="6" width="24" height="20" rx="3" />
    <circle cx="12" cy="13" r="2.2" />
    <path d="m6 23 7-7 5 5 3-3 5 5" />
  </svg>
);

const PdfIcon = () => (
  <svg {...svg}>
    <path d="M19 4H9a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10z" />
    <path d="M19 4v6h6M12 17h8M12 22h5" />
  </svg>
);

const PlayIcon = () => (
  <svg {...svg}>
    <rect x="3" y="7" width="26" height="18" rx="4" />
    <path d="m13 12 8 4-8 4z" fill="currentColor" stroke="none" />
  </svg>
);

const SparkIcon = () => (
  <svg {...svg}>
    <path d="M28 15.5c0 5.8-5.4 10.5-12 10.5a14 14 0 0 1-3.6-.5L5 28l2.2-5.6A9.7 9.7 0 0 1 4 15.5C4 9.7 9.4 5 16 5s12 4.7 12 10.5Z" />
    <path d="m20 11 1.2 2.6L24 15l-2.8 1.4L20 19l-1.2-2.6L16 15l2.8-1.4z" fill="currentColor" stroke="none" />
  </svg>
);

const VideoIcon = () => (
  <svg viewBox="0 0 48 48" className="size-12" fill="none" aria-hidden="true">
    <path d="M28 6H14a3 3 0 0 0-3 3v30a3 3 0 0 0 3 3h20a3 3 0 0 0 3-3V15z" fill="#0C3C85" />
    <path d="M28 6v9h9" fill="#fff" fillOpacity="0.35" />
    <path d="m20 20 10 6-10 6z" fill="#fff" />
  </svg>
);

const FolderPlusIcon = () => (
  <svg viewBox="0 0 40 40" className="size-10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 10a2 2 0 0 1 2-2h8l3 4h13a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <circle cx="29" cy="27" r="6" fill="#0C3C85" stroke="none" />
    <path d="M29 24v6M26 27h6" stroke="#fff" strokeLinecap="round" />
  </svg>
);
