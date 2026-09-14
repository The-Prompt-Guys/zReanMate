import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { ArrowRightIcon, Button } from '../../components/ui.jsx';
import { kits } from '../../mock/fixtures.js';
import { useLanguage, useT } from '../../i18n/index.js';

/**
 * docs/screens/07-practice/01-practice-setup — the three controls map exactly
 * onto practice_sessions.question_count / answer_format / timer_seconds.
 */
export const PracticeSetupPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const kit = kits[1];

  const [count, setCount] = useState(10);
  const [format, setFormat] = useState('multiple_choice');
  const [timer, setTimer] = useState(600);

  return (
    <main>
      <NavyHeader>
        <div className="flex items-start gap-3">
          <Link to="/practice" aria-label={t('common.back')} className="mt-1 shrink-0">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
              <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight">
              {params.get('mock') === '1' ? t('practice.mockExam') : t('practice.title')}
            </h1>
            <p className="mt-0.5 truncate text-base text-white/75">
              {language === 'km' ? kit.titleKm : kit.title}
            </p>
          </div>
        </div>
      </NavyHeader>

      <div className="px-5 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold leading-tight text-navy-900">
              {t('practice.setupTitle')}
            </h2>
            <p className="mt-1.5 text-base text-navy-600">{t('practice.setupSubtitle')}</p>
          </div>
          <Owl variant="waving" className="size-20 shrink-0" />
        </div>

        <ControlGroup label={t('practice.questionCount')}>
          {[5, 10, 20, 12].map((value, i) => (
            <Choice
              key={value}
              selected={count === value}
              onClick={() => setCount(value)}
              label={i === 3 ? t('practice.all', { count: value }) : String(value)}
            />
          ))}
        </ControlGroup>

        <ControlGroup label={t('practice.answerFormat')}>
          <Choice
            wide
            selected={format === 'multiple_choice'}
            onClick={() => setFormat('multiple_choice')}
            icon={<ChoiceIcon />}
            label={t('practice.multipleChoice')}
          />
          <Choice
            wide
            selected={format === 'written'}
            onClick={() => setFormat('written')}
            icon={<WriteIcon />}
            label={t('practice.writeAnswer')}
          />
        </ControlGroup>

        <ControlGroup label={t('practice.timer')}>
          {[0, 300, 600, 1200].map((value) => (
            <Choice
              key={value}
              selected={timer === value}
              onClick={() => setTimer(value)}
              label={value === 0 ? t('practice.noTimer') : t('practice.minutes', { count: value / 60 })}
            />
          ))}
        </ControlGroup>

        <p className="mt-5 text-center text-sm text-navy-600">{t('practice.settingsHint')}</p>

        <div className="mt-4 pb-4">
          <Button onClick={() => navigate('/practice/lessons')}>
            {t('practice.start')}
            <ArrowRightIcon />
          </Button>
        </div>
      </div>
    </main>
  );
};

const ControlGroup = ({ label, children }) => (
  <section className="mt-5 rounded-card bg-tint-100/70 p-4">
    <h3 className="text-lg font-bold text-navy-900">{label}</h3>
    <div className="mt-3 flex flex-wrap gap-2">{children}</div>
  </section>
);

const Choice = ({ selected, onClick, label, icon, wide = false }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={`flex items-center justify-center gap-2.5 rounded-xl px-4 py-3.5 text-base font-semibold transition-colors ${
      wide ? 'flex-1 basis-[46%]' : 'flex-1 basis-[20%]'
    } ${selected ? 'bg-navy-800 text-white' : 'bg-white text-navy-900'}`}
  >
    {icon}
    <span className={wide ? 'text-left leading-snug' : ''}>{label}</span>
  </button>
);

const ChoiceIcon = () => (
  <svg viewBox="0 0 24 24" className="size-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M7 9h.01M7 15h.01M11 9h6M11 15h4" strokeLinecap="round" />
  </svg>
);

const WriteIcon = () => (
  <svg viewBox="0 0 24 24" className="size-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20.5 5.4 15 16.5 3.9a2.3 2.3 0 0 1 3.2 3.2L8.6 18.2z" />
    <path d="m14.6 5.8 3.2 3.2" />
  </svg>
);
