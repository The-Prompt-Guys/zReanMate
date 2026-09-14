import { useState } from 'react';
import { Link } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { Button } from '../../components/ui.jsx';
import { assignment, assignmentQuestions } from '../../mock/fixtures.js';
import { useLanguage, useT } from '../../i18n/index.js';

/** docs/screens/09-classes-assignments/06-assignment-quiz-workspace. */
export const AssignmentWorkspacePage = () => {
  const t = useT();
  const { language } = useLanguage();
  const [answers, setAnswers] = useState({});

  const total = assignment.questionCount;
  const answered = Object.keys(answers).length;
  const complete = answered === assignmentQuestions.length;

  return (
    <main>
      <NavyHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Link to="/assignments/a1" aria-label={t('common.back')} className="mt-1 shrink-0">
              <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
                <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-tight">
                {language === 'km' ? assignment.titleKm : assignment.title}
              </h1>
              <p className="mt-0.5 truncate text-base text-white/75">{assignment.className}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Owl variant="waving" className="size-14" />
            <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-bold text-navy-900">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.9" />
                <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
              {t('assignments.due', { date: assignment.dueLabel })}
            </span>
          </div>
        </div>
      </NavyHeader>

      <div className="px-5 pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-lg font-bold text-navy-900">
            {t('quiz.question', { current: Math.max(1, answered), total })}
          </p>
          <p className="text-sm text-navy-600">
            {t('assignments.progress', { done: answered, total })}
          </p>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-tint-100">
          <span
            className="block h-full rounded-full bg-navy-800 transition-[width]"
            style={{ width: `${Math.max(8, (answered / total) * 100)}%` }}
          />
        </div>

        <ol className="mt-4 space-y-4">
          {assignmentQuestions.map((question, index) => (
            <li key={question.id} className="rounded-card bg-white p-4 shadow-sm ring-1 ring-tint-200/70">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-tint-200 font-bold text-navy-800">
                  {index + 1}
                </span>
                <h2 className="mt-1 text-lg font-bold leading-snug text-navy-900">
                  {language === 'km' ? question.promptKm : question.prompt}
                </h2>
              </div>

              <ul className="mt-3 space-y-1">
                {(language === 'km' ? question.optionsKm : question.options).map((option, i) => {
                  const selected = answers[question.id] === i;
                  return (
                    <li key={option}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5">
                        <input
                          type="radio"
                          name={question.id}
                          className="sr-only"
                          checked={selected}
                          onChange={() => setAnswers((a) => ({ ...a, [question.id]: i }))}
                        />
                        <span
                          className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${
                            selected ? 'border-navy-800' : 'border-ink-400'
                          }`}
                        >
                          {selected && <span className="size-3 rounded-full bg-navy-800" />}
                        </span>
                        <span className="text-base text-navy-900">{option}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>

        <p className="mt-5 flex items-center justify-center gap-2 text-sm text-navy-600">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t('assignments.scrollHint')}
        </p>

        <div className="mt-3 space-y-3 pb-4">
          <Button disabled={!complete} onClick={() => {}}>
            {t('assignments.submitQuiz')}
          </Button>
          {!complete && (
            <p className="text-center text-sm text-navy-600">{t('assignments.answerAllFirst')}</p>
          )}
          <div className="text-center">
            <Link to="/tutor" className="font-semibold text-navy-700">
              {t('assignments.askAi')}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
};
