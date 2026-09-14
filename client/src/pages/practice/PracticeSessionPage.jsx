import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { Button } from '../../components/ui.jsx';
import { batchQuestions } from '../../mock/fixtures.js';
import { useLanguage, useT } from '../../i18n/index.js';

/**
 * docs/screens/07-practice/03-practice-batch-session — every question on one
 * scrolling page with a countdown, rather than one at a time like the quiz.
 */
export const PracticeSessionPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [answers, setAnswers] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(598);

  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  const answered = Object.keys(answers).length;
  const total = batchQuestions.length;
  const complete = answered === total;

  const mmss = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;

  return (
    <main>
      <NavyHeader className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/practice/lessons" aria-label={t('common.back')} className="shrink-0">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
              <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="truncate text-2xl font-bold">{t('practice.title')}</h1>
        </div>
        <span className="flex shrink-0 items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-base font-bold">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.9" />
            <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
          {t('practice.timeLeft', { time: mmss })}
        </span>
      </NavyHeader>

      <div className="px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold leading-tight text-navy-900">
              {t('practice.answerAll', { count: total })}
            </h2>
            <p className="mt-1 text-base text-navy-600">
              {t('practice.answeredOf', { done: answered, total })}
            </p>
          </div>
          <Owl variant="waving" className="size-20 shrink-0" />
        </div>

        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-tint-100">
          <span
            className="block h-full rounded-full bg-navy-800 transition-[width]"
            style={{ width: `${(answered / total) * 100}%` }}
          />
        </div>

        <ol className="mt-5 space-y-4">
          {batchQuestions.map((question, index) => (
            <li key={question.id} className="rounded-card bg-tint-100/60 p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-tint-200 font-bold text-navy-800">
                  {index + 1}
                </span>
                <h3 className="mt-1 text-lg font-bold leading-snug text-navy-900">
                  {language === 'km' ? question.promptKm : question.prompt}
                </h3>
              </div>

              <ul className="mt-3 space-y-2">
                {(language === 'km' ? question.optionsKm : question.options).map((option, i) => {
                  const selected = answers[question.id] === i;
                  return (
                    <li key={option}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                          selected ? 'bg-navy-800 text-white' : 'bg-white text-navy-900'
                        }`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          className="sr-only"
                          checked={selected}
                          onChange={() => setAnswers((a) => ({ ...a, [question.id]: i }))}
                        />
                        <span
                          className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${
                            selected ? 'border-white' : 'border-ink-400'
                          }`}
                        >
                          {selected && <span className="size-2.5 rounded-full bg-white" />}
                        </span>
                        <span className="text-base">{option}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>

        <p className="mt-5 text-center text-sm text-navy-600">{t('practice.scrollHint')}</p>

        <div className="mt-3 space-y-2 pb-4">
          <Button disabled={!complete} onClick={() => navigate('/practice/results')}>
            {t('practice.submit')}
          </Button>
          {!complete && (
            <p className="text-center text-sm text-navy-600">{t('practice.answerAllToSubmit')}</p>
          )}
        </div>
      </div>
    </main>
  );
};
