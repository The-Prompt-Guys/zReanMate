import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { Button } from '../../components/ui.jsx';
import { useLanguage, useT } from '../../i18n/index.js';
import { useAssignment } from './useAssignment.js';

/** docs/screens/09-classes-assignments/06-assignment-quiz-workspace. */
export const AssignmentWorkspacePage = () => {
  const t = useT();
  const { language } = useLanguage();
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { data, questions: assignmentQuestions, status, error, saveAnswers } = useAssignment(assignmentId, { questions: true });
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data?.submission?.answers) setAnswers(data.submission.answers); }, [data?.submission?.answers]);
  const assignment = data?.assignment;
  const total = assignment?.questionCount ?? assignmentQuestions.length;
  const answered = Object.keys(answers).length;
  const complete = answered === assignmentQuestions.length;

  const choose = async (questionId, value) => {
    const next = { ...answers, [questionId]: value };
    setAnswers(next); setSaving(true);
    try { await saveAnswers(next, false); } finally { setSaving(false); }
  };
  const submit = async () => {
    setSaving(true);
    try { await saveAnswers(answers, true); navigate(`/assignments/${assignmentId}`); }
    finally { setSaving(false); }
  };
  const dueLabel = assignment?.dueAt ? new Intl.DateTimeFormat(language === 'km' ? 'km-KH' : 'en', { dateStyle: 'medium' }).format(new Date(assignment.dueAt)) : '';

  if (status === 'loading') return <main className="grid min-h-dvh place-items-center text-navy-700">{t('common.loading')}</main>;
  if (error || !assignment) return <main className="grid min-h-dvh place-items-center px-6 text-center text-danger-600">{error?.message ?? 'Assignment not found.'}</main>;

  return (
    <main>
      <NavyHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Link to={`/assignments/${assignmentId}`} aria-label={t('common.back')} className="mt-1 shrink-0">
              <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
                <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-tight">
                {assignment.title}
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
              {t('assignments.due', { date: dueLabel })}
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
                  {question.prompt}
                </h2>
              </div>

              <ul className="mt-3 space-y-1">
                {question.options.map((option, i) => {
                  const selected = answers[question.id] === i;
                  return (
                    <li key={option}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5">
                        <input
                          type="radio"
                          name={question.id}
                          className="sr-only"
                          checked={selected}
                          disabled={saving}
                          onChange={() => choose(question.id, i)}
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
          <Button disabled={!complete || saving} onClick={submit}>
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
