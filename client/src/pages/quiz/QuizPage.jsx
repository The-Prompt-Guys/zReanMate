import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { StudyTabBar } from '../../components/StudyTabBar.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { Button, CheckIcon } from '../../components/ui.jsx';
import { quizQuestions, quizResult, kits } from '../../mock/fixtures.js';
import { useLanguage, useT } from '../../i18n/index.js';

/**
 * docs/screens/06-quiz/01-quiz-controls-reordered, and 02 once an answer is
 * checked. `?explain=1` opens straight into the explained state so that
 * screenshot is directly reviewable.
 */
export const QuizPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { kitId = 'kit-database' } = useParams();
  const [params] = useSearchParams();

  const kit = kits.find((k) => k.id === kitId) ?? kits[1];
  const total = quizResult.total;

  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState(params.get('explain') === '1' ? 0 : null);
  const [checked, setChecked] = useState(params.get('explain') === '1');

  const question = quizQuestions[index % quizQuestions.length];
  const options = language === 'km' ? question.optionsKm : question.options;
  const isCorrect = choice === question.correct;

  const next = () => {
    if (index + 1 >= total) {
      navigate(`/quiz/${kit.id}/results`);
      return;
    }
    setIndex((i) => i + 1);
    setChoice(null);
    setChecked(false);
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <NavyHeader className="shrink-0">
        <div className="flex items-start gap-3">
          <Link to={`/kits/${kit.id}`} aria-label={t('common.back')} className="mt-1 shrink-0">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
              <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight">{t('study.quizMe')}</h1>
            <p className="mt-0.5 truncate text-base text-white/75">
              {language === 'km' ? kit.titleKm : kit.title}
            </p>
          </div>
        </div>
      </NavyHeader>

      <div className="flex-1 px-5 pt-5">
        <p className="text-base font-bold text-navy-900">
          {t('quiz.question', { current: index + 1, total })}
        </p>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-tint-100">
          <span
            className="block h-full rounded-full bg-navy-800 transition-[width]"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-card bg-white p-5 shadow-sm ring-1 ring-tint-200/70">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold uppercase tracking-wide text-navy-600/80">
              {t('quiz.checkUnderstanding')}
            </p>
            <h2 className="mt-1.5 text-2xl font-bold leading-tight text-navy-900">
              {language === 'km' ? question.promptKm : question.prompt}
            </h2>
          </div>
          <Owl variant="default" className="size-16 shrink-0" />
        </div>

        <ul className="mt-4 space-y-3" role="radiogroup" aria-label={t('quiz.title')}>
          {options.map((option, i) => {
            const selected = choice === i;
            const revealCorrect = checked && i === question.correct;
            const revealWrong = checked && selected && i !== question.correct;

            return (
              <li key={option}>
                <label
                  className={`flex cursor-pointer items-center gap-4 rounded-card border p-4 transition-colors ${
                    revealCorrect
                      ? 'border-navy-700 bg-tint-100'
                      : revealWrong
                        ? 'border-danger-600 bg-danger-50'
                        : selected
                          ? 'border-navy-700 bg-tint-100'
                          : 'border-tint-200 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="answer"
                    className="sr-only"
                    checked={selected}
                    disabled={checked}
                    onChange={() => setChoice(i)}
                  />
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full border-2 ${
                      revealCorrect || (selected && !checked)
                        ? 'border-navy-800 bg-navy-800'
                        : revealWrong
                          ? 'border-danger-600 bg-danger-600'
                          : 'border-ink-400'
                    }`}
                  >
                    {(revealCorrect || (selected && !checked)) && <CheckIcon />}
                    {revealWrong && (
                      <svg viewBox="0 0 20 20" className="size-3.5 text-white" fill="none" aria-hidden="true">
                        <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    )}
                  </span>
                  <span className="text-base font-semibold text-navy-900">{option}</span>
                </label>
              </li>
            );
          })}
        </ul>

        {checked && (
          <section className="mt-4 rounded-card bg-tint-100 p-5">
            <p className="text-sm font-bold uppercase tracking-wide text-navy-600/80">
              {t(isCorrect ? 'quiz.whyCorrect' : 'quiz.whyWrong')}
            </p>
            <h3 className="mt-1 text-xl font-bold text-navy-900">
              {t('quiz.explanationHeading')}
            </h3>
            <p className="mt-2 leading-relaxed text-navy-700">
              {language === 'km' ? question.explanationKm : question.explanation}
            </p>
            <Link to="/tutor" className="mt-3 inline-block text-sm text-navy-600 underline">
              {t('quiz.askOwl')}
            </Link>
          </section>
        )}

        {!checked && (
          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="flex items-center gap-1 font-semibold text-navy-800 disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
                <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('common.back')}
            </button>
            <button type="button" onClick={next} className="flex items-center gap-1 font-semibold text-navy-800">
              {t('common.skip')}
              <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
                <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}

        <div className="mt-4 space-y-3 pb-4">
          {checked ? (
            <Button onClick={next}>{t('quiz.nextQuestion')}</Button>
          ) : (
            <>
              <Button onClick={() => setChecked(true)} disabled={choice === null}>
                {t('quiz.checkAnswer')}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setChoice(question.correct);
                    setChecked(true);
                  }}
                  className="font-semibold text-navy-800"
                >
                  {t('quiz.showAnswer')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <StudyTabBar kitId={kit.id} active="practice" />
    </main>
  );
};
