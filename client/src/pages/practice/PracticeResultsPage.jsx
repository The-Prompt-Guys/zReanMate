import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckIcon } from '../../components/ui.jsx';
import { useT } from '../../i18n/index.js';
import { api } from '../../lib/api.js';
import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';

/**
 * How the student's own answer is rendered back to them.
 *
 * A multiple-choice response is stored as an index into the options, so it has
 * to be looked back up; a written response is the text itself. An unanswered
 * question is neither, and saying so is better than an empty line the student
 * has to interpret.
 */
const answerText = (question, t) => {
  const { response, options } = question;
  if (response === null || response === undefined || response === '') return t('practice.notAnswered');
  if (typeof response === 'number') return options?.[response] ?? t('practice.notAnswered');
  return String(response);
};

/**
 * One question, marked.
 *
 * `isCorrect` is null when a question was never answered — distinct from false,
 * which is an answer that was wrong. Both read as not-correct here, but only a
 * genuine attempt gets feedback written about it.
 */
const ReviewItem = ({ question, t }) => {
  const correct = question.isCorrect === true;
  return (
    <li className="rounded-card bg-white p-4 ring-1 ring-tint-200">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${correct ? 'bg-navy-800' : 'bg-tint-200'}`}
          aria-hidden="true"
        >
          {correct
            ? <CheckIcon />
            : <svg viewBox="0 0 24 24" className="size-4" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-navy-900">{question.position}. {question.prompt}</p>
          <p className="mt-0.5 text-sm font-semibold text-navy-600">
            {t(correct ? 'quiz.correct' : 'quiz.incorrect')}
          </p>
        </div>
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="font-semibold text-navy-600">{t('practice.yourAnswer')}</dt>
          <dd className="whitespace-pre-wrap break-words text-navy-800">{answerText(question, t)}</dd>
        </div>
        {!correct && question.correctAnswer ? (
          <div>
            <dt className="font-semibold text-navy-600">{t('practice.correctAnswerLabel')}</dt>
            <dd className="whitespace-pre-wrap break-words text-navy-800">{question.correctAnswer}</dd>
          </div>
        ) : null}
        {/* Written answers only: why the mark came out the way it did. A wrong
            multiple-choice answer explains itself; a wrong mark on free text
            does not, and without a reason the score just looks broken. */}
        {question.graderNote ? (
          <div>
            <dt className="font-semibold text-navy-600">{t('practice.feedback')}</dt>
            <dd className="whitespace-pre-wrap break-words text-navy-800">{question.graderNote}</dd>
          </div>
        ) : null}
        {question.explanation ? (
          <div>
            <dt className="font-semibold text-navy-600">{t('quiz.explanation')}</dt>
            <dd className="whitespace-pre-wrap break-words text-navy-700">{question.explanation}</dd>
          </div>
        ) : null}
      </dl>
    </li>
  );
};

export const PracticeResultsPage = () => {
  const t = useT();
  const [params] = useSearchParams();
  const id = params.get('sessionId') || window.localStorage.getItem('reanmate:practice-session');
  const [result, setResult] = useState(null);
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    if (!id) return;
    api.get(`/practice/sessions/${id}`).then(({ data }) => {
      setResult({
        ...data.session,
        total: data.session.questionCount,
        toReview: data.session.answered - data.session.correct,
      });
      // The answer key arrives only once the session is completed — the server
      // withholds it while an exam is being sat.
      setQuestions(data.questions ?? []);
    });
  }, [id]);

  return <main><NavyHeader><Link to="/practice" aria-label={t('common.back')}>← {t('practice.completeTitle')}</Link></NavyHeader><div className="px-5 pt-6"><div className="text-center"><Owl variant="waving" className="mx-auto size-24" /><h2 className="text-2xl font-bold text-navy-900">{t('practice.completeTitle')}</h2><p className="text-navy-600">{t('practice.completeSubtitle',{count:result?.total??0})}</p></div><div className="mt-5 rounded-card bg-tint-100 py-7 text-center"><p className="text-5xl font-bold text-navy-900">{result?.correct??0} / {result?.total??0}</p><p className="text-navy-600">{t('quiz.correctAnswers')}</p></div><section className="mt-4 rounded-card bg-white p-5 ring-1 ring-tint-200"><p className="text-xl font-bold text-navy-900">{t('quiz.mastery',{percent:result?.mastery??0})}</p><div className="mt-2 h-2.5 bg-tint-100"><span className="block h-full bg-navy-800" style={{width:`${result?.mastery??0}%`}} /></div></section><ul className="mt-4 rounded-card bg-white px-5 ring-1 ring-tint-200"><li className="flex gap-3 py-3"><span className="grid size-7 place-items-center rounded-full bg-navy-800"><CheckIcon /></span>{t('practice.correctCount',{count:result?.correct??0})}</li><li className="py-3">{t('practice.toReview',{count:result?.toReview??0})}</li></ul><section className="mt-4 rounded-card bg-white p-5 ring-1 ring-tint-200"><h3 className="text-xl font-bold text-navy-900">{t('practice.whatToReview')}</h3><ul>{(result?.weakTopics??[]).map((topic)=><li key={topic} className="py-2 text-navy-800">{topic}</li>)}</ul></section>
    {questions.length > 0 ? (
      <section className="mt-4 pb-4">
        <h3 className="text-xl font-bold text-navy-900">{t('practice.reviewExplanations')}</h3>
        <ul className="mt-3 space-y-3">
          {questions.map((question) => (
            <ReviewItem key={question.id} question={question} t={t} />
          ))}
        </ul>
      </section>
    ) : null}
  </div></main>;
};
