import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { StudyTabBar } from '../../components/StudyTabBar.jsx';
import { Button, CheckIcon } from '../../components/ui.jsx';
import { useLanguage, useT } from '../../i18n/index.js';
import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { useQuizAttempt } from '../../quiz/useQuizAttempt.js';
import { useStudySource } from '../study/useSourceSummaries.js';

export const QuizPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { kitId } = useParams();
  const [params] = useSearchParams();
  const { kit, source } = useStudySource(kitId);
  const { questions, status, answer, submit } = useQuizAttempt({ kitId, source, language });
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState(params.get('explain') === '1' ? 0 : null);
  const [checking, setChecking] = useState(false);
  const question = questions[index];
  const checked = question?.isCorrect !== null && question?.isCorrect !== undefined;
  const total = questions.length;
  const title = language === 'km' ? (kit?.titleKm || kit?.title) : kit?.title;

  const check = async (response = choice) => {
    if (!question || response === null) return;
    setChecking(true);
    try { await answer(question.id, response); } finally { setChecking(false); }
  };
  const next = async () => {
    if (index + 1 >= total) {
      const result = await submit();
      navigate(`/quiz/${kitId}/results?attemptId=${result.id}`);
    } else {
      setIndex((value) => value + 1);
      setChoice(null);
    }
  };

  return <main className="flex min-h-dvh flex-col">
    <NavyHeader className="shrink-0"><div className="flex items-start gap-3"><Link to={`/kits/${kitId}`} aria-label={t('common.back')} className="mt-1 shrink-0"><svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></Link><div className="min-w-0"><h1 className="text-2xl font-bold leading-tight">{t('study.quizMe')}</h1><p className="mt-0.5 truncate text-base text-white/75">{title}</p></div></div></NavyHeader>
    {status !== 'ready' || !question ? <div className="flex flex-1 items-center justify-center px-5 text-navy-600">{t(status === 'error' ? 'quiz.loadFailed' : 'quiz.generating')}</div> : <div className="flex-1 px-5 pt-5">
      <p className="text-base font-bold text-navy-900">{t('quiz.question', { current: index + 1, total })}</p><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-tint-100"><span className="block h-full rounded-full bg-navy-800 transition-[width]" style={{ width: `${((index + 1) / total) * 100}%` }} /></div>
      <div className="mt-4 flex items-start gap-3 rounded-card bg-white p-5 shadow-sm ring-1 ring-tint-200/70"><div className="min-w-0 flex-1"><p className="text-sm font-bold uppercase tracking-wide text-navy-600/80">{t('quiz.checkUnderstanding')}</p><h2 className="mt-1.5 text-2xl font-bold leading-tight text-navy-900">{question.prompt}</h2></div><Owl variant="default" className="size-16 shrink-0" /></div>
      {question.options.length > 0 ? <ul className="mt-4 space-y-3" role="radiogroup" aria-label={t('quiz.title')}>{question.options.map((option, optionIndex) => { const selected = choice === optionIndex || question.response === optionIndex; const revealCorrect = checked && optionIndex === question.correctAnswer; const revealWrong = checked && selected && optionIndex !== question.correctAnswer; return <li key={option}><label className={`flex cursor-pointer items-center gap-4 rounded-card border p-4 ${revealCorrect ? 'border-navy-700 bg-tint-100' : revealWrong ? 'border-danger-600 bg-danger-50' : selected ? 'border-navy-700 bg-tint-100' : 'border-tint-200 bg-white'}`}><input type="radio" name="answer" className="sr-only" checked={selected} disabled={checked} onChange={() => setChoice(optionIndex)} /><span className={`grid size-7 shrink-0 place-items-center rounded-full border-2 ${revealCorrect || (selected && !checked) ? 'border-navy-800 bg-navy-800' : revealWrong ? 'border-danger-600 bg-danger-600' : 'border-ink-400'}`}>{(revealCorrect || (selected && !checked)) && <CheckIcon />}</span><span className="text-base font-semibold text-navy-900">{option}</span></label></li>; })}</ul> : <textarea value={typeof choice === 'string' ? choice : (question.response ?? '')} disabled={checked} onChange={(event) => setChoice(event.target.value)} className="mt-4 min-h-32 w-full rounded-card border border-tint-200 bg-white p-4 text-navy-900 focus:border-navy-700 focus:outline-none" aria-label={t('quiz.title')} />}
      {checked && <section className="mt-4 rounded-card bg-tint-100 p-5"><p className="text-sm font-bold uppercase tracking-wide text-navy-600/80">{t(question.isCorrect ? 'quiz.whyCorrect' : 'quiz.whyWrong')}</p><h3 className="mt-1 text-xl font-bold text-navy-900">{t('quiz.explanation')}</h3><p className="mt-2 leading-relaxed text-navy-700">{question.explanation}</p><Link to={`/tutor?kitId=${kitId}`} className="mt-3 inline-block text-sm text-navy-600 underline">{t('quiz.askOwl')}</Link></section>}
      {!checked && <div className="mt-5 flex items-center justify-between"><button type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0} className="font-semibold text-navy-800 disabled:opacity-40">{t('common.back')}</button><button type="button" onClick={next} className="font-semibold text-navy-800">{t('common.skip')}</button></div>}
      <div className="mt-4 space-y-3 pb-4">{checked ? <Button onClick={next}>{t('quiz.nextQuestion')}</Button> : <><Button onClick={() => check()} disabled={choice === null || choice === '' || checking}>{t('quiz.checkAnswer')}</Button>{question.options.length > 0 && <div className="text-center"><button type="button" onClick={() => check(0)} className="font-semibold text-navy-800">{t('quiz.showAnswer')}</button></div>}</>}</div>
    </div>}
    <StudyTabBar kitId={kitId} active="practice" />
  </main>;
};
