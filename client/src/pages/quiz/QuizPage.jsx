import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { StudyTabBar } from '../../components/StudyTabBar.jsx';
import { Button, CheckIcon } from '../../components/ui.jsx';
import { useLanguage, useT } from '../../i18n/index.js';
import { api } from '../../lib/api.js';
import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { MessageBubble, OwlAvatar } from '../tutor/TutorPage.jsx';
import { useQuizAttempt } from '../../quiz/useQuizAttempt.js';
import { useStudySource } from '../study/useSourceSummaries.js';

export const QuizPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { kitId } = useParams();
  const [params] = useSearchParams();
  const forceNew = params.get('generateNew') === '1';
  const { kit, source, sourceId } = useStudySource(kitId);
  const { attempt, questions, status, answer, submit } = useQuizAttempt({ kitId, source, language, forceNew });
  const [index, setIndex] = useState(0);
  const resumedAttempt = useRef(null);
  const [choice, setChoice] = useState(params.get('explain') === '1' ? 0 : null);
  const [checking, setChecking] = useState(false);
  const [owlOpen, setOwlOpen] = useState(false);
  const question = questions[index];
  const checked = question?.isCorrect !== null && question?.isCorrect !== undefined;
  const total = questions.length;
  const kitTitle = language === 'km' ? (kit?.titleKm || kit?.title) : kit?.title;
  // The subtitle under "Quiz me" names the material the questions came from,
  // so a quiz built from one file is never mistaken for the kit's.
  const title = sourceId ? (source?.name ?? t('common.loading')) : kitTitle;
  const sourceStillProcessing = !!source && source.status !== 'ready';

  useEffect(() => {
    if (!attempt?.id || !questions.length || resumedAttempt.current === attempt.id) return;
    resumedAttempt.current = attempt.id;
    const firstUnanswered = questions.findIndex((item) => item.response === null || item.response === undefined);
    setIndex(firstUnanswered === -1 ? 0 : firstUnanswered);
  }, [attempt?.id, questions]);

  if (sourceStillProcessing) {
    return <main className="flex min-h-dvh flex-col">
      <NavyHeader className="shrink-0"><div className="flex items-start gap-3"><Link to={`/kits/${kitId}`} aria-label={t('common.back')} className="mt-1 shrink-0"><svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></Link><div className="min-w-0"><h1 className="text-2xl font-bold leading-tight">{t('study.quizMe')}</h1><p className="mt-0.5 truncate text-base text-white/75">{title}</p></div></div></NavyHeader>
      <div className="flex flex-1 items-center justify-center px-5 text-center text-navy-600">
        <div>
          <p className="text-base font-bold text-navy-900">{t('quiz.generating')}</p>
          <p className="mt-2 text-sm text-navy-600">{source?.name ?? t('summary.heading')}</p>
        </div>
      </div>
      <StudyTabBar kitId={kitId} sourceId={sourceId} active="practice" />
    </main>;
  }

  const check = async (response = choice) => {
    if (!question || response === null) return;
    setChecking(true);
    try { await answer(question.id, response); } finally { setChecking(false); }
  };
  const next = async () => {
    if (index + 1 >= total) {
      const result = await submit();
      navigate(`/quiz/${kitId}/results?attemptId=${result.id}${sourceId ? `&sourceId=${encodeURIComponent(sourceId)}` : ''}`);
    } else {
      setIndex((value) => value + 1);
      setChoice(null);
    }
  };

  const explain = {
    kitId,
    sourceId,
    prompt: question?.prompt,
    explanation: question?.explanation,
    selectedAnswer: typeof question?.response === 'number' ? question.options[question.response] : question?.response,
    correctAnswer: question?.options?.[question?.correctAnswer],
  };

  return <main className="flex min-h-dvh flex-col">
    <NavyHeader className="shrink-0"><div className="flex items-start gap-3"><Link to={`/kits/${kitId}`} aria-label={t('common.back')} className="mt-1 shrink-0"><svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></Link><div className="min-w-0"><h1 className="text-2xl font-bold leading-tight">{t('study.quizMe')}</h1><p className="mt-0.5 truncate text-base text-white/75">{title}</p></div></div></NavyHeader>
    {status !== 'ready' || !question ? <div className="flex flex-1 items-center justify-center px-5 text-navy-600">{t(status === 'error' ? 'quiz.loadFailed' : 'quiz.generating')}</div> : <div className="flex-1 px-5 pt-5">
      <p className="text-base font-bold text-navy-900">{t('quiz.question', { current: index + 1, total })}</p><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-tint-100"><span className="block h-full rounded-full bg-navy-800 transition-[width]" style={{ width: `${((index + 1) / total) * 100}%` }} /></div>
      <div className="mt-4 flex items-start gap-3 rounded-card bg-white p-5 shadow-sm ring-1 ring-tint-200/70"><div className="min-w-0 flex-1"><p className="text-sm font-bold uppercase tracking-wide text-navy-600/80">{t('quiz.checkUnderstanding')}</p><h2 className="mt-1.5 text-2xl font-bold leading-tight text-navy-900">{question.prompt}</h2>{/* Named so a repeat question does not read as the app asking at random — it is here because this is what they got wrong last time. */}{question.targetedWeakConcept && <p className="mt-2 inline-flex rounded-full bg-gold-400/30 px-3 py-1 text-sm font-bold text-navy-900">{t('quiz.targetedWeakArea', { concept: question.targetedWeakConcept })}</p>}</div><Owl variant="default" className="size-16 shrink-0" /></div>
      {question.options.length > 0 ? <ul className="mt-4 space-y-3" role="radiogroup" aria-label={t('quiz.title')}>{question.options.map((option, optionIndex) => { const selected = choice === optionIndex || question.response === optionIndex; const revealCorrect = checked && optionIndex === question.correctAnswer; const revealWrong = checked && selected && optionIndex !== question.correctAnswer; return <li key={option}><label className={`flex cursor-pointer items-center gap-4 rounded-card border p-4 ${revealCorrect ? 'border-navy-700 bg-tint-100' : revealWrong ? 'border-danger-600 bg-danger-50' : selected ? 'border-navy-700 bg-tint-100' : 'border-tint-200 bg-white'}`}><input type="radio" name="answer" className="sr-only" checked={selected} disabled={checked} onChange={() => setChoice(optionIndex)} /><span className={`grid size-7 shrink-0 place-items-center rounded-full border-2 ${revealCorrect || (selected && !checked) ? 'border-navy-800 bg-navy-800' : revealWrong ? 'border-danger-600 bg-danger-600' : 'border-ink-400'}`}>{(revealCorrect || (selected && !checked)) && <CheckIcon />}</span><span className="text-base font-semibold text-navy-900">{option}</span></label></li>; })}</ul> : <textarea value={typeof choice === 'string' ? choice : (question.response ?? '')} disabled={checked} onChange={(event) => setChoice(event.target.value)} className="mt-4 min-h-32 w-full rounded-card border border-tint-200 bg-white p-4 text-navy-900 focus:border-navy-700 focus:outline-none" aria-label={t('quiz.title')} />}
      {checked && <section className="mt-4 rounded-card bg-tint-100 p-5"><p className="text-sm font-bold uppercase tracking-wide text-navy-600/80">{t(question.isCorrect ? 'quiz.whyCorrect' : 'quiz.whyWrong')}</p><h3 className="mt-1 text-xl font-bold text-navy-900">{t('quiz.explanation')}</h3><p className="mt-2 leading-relaxed text-navy-700">{question.explanation}</p><button type="button" onClick={() => setOwlOpen(true)} className="mt-3 text-sm text-navy-600 underline">{t('quiz.askOwl')}</button></section>}
      {!checked && <div className="mt-5 flex items-center justify-between"><button type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0} className="font-semibold text-navy-800 disabled:opacity-40">{t('common.back')}</button><button type="button" onClick={next} className="font-semibold text-navy-800">{t('common.skip')}</button></div>}
      <div className="mt-4 space-y-3 pb-4">{checked ? <Button onClick={next}>{t('quiz.nextQuestion')}</Button> : <><Button onClick={() => check()} disabled={choice === null || choice === '' || checking}>{t('quiz.checkAnswer')}</Button>{question.options.length > 0 && <div className="text-center"><button type="button" onClick={() => check(0)} className="font-semibold text-navy-800">{t('quiz.showAnswer')}</button></div>}</>}</div>
    </div>}
    <StudyTabBar kitId={kitId} sourceId={sourceId} active="practice" />
    {owlOpen && <QuizTutorPopup explain={explain} language={language} t={t} onClose={() => setOwlOpen(false)} />}
  </main>;
};

const QuizTutorPopup = ({ explain, language, t, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const initialRequestSent = useRef(false);

  const ask = async (content) => {
    const text = content.trim();
    if (!text || loading) return;
    setDraft('');
    setLoading(true);
    const requestId = `quiz-help-${Date.now()}-${Math.random()}`;
    setMessages((current) => [...current, { id: `${requestId}-user`, role: 'user', content: text, status: 'complete', citations: [] }]);
    const context = [
      `Explain this quiz question clearly: ${explain.prompt}`,
      explain.selectedAnswer ? `My answer: ${explain.selectedAnswer}` : '',
      `Correct answer: ${explain.correctAnswer}`,
      `Existing explanation: ${explain.explanation}`,
      `Student follow-up: ${text}`,
    ].filter(Boolean).join('\n');
    try {
      const { data } = await api.post('/chat/explain', {
        kitId: explain.kitId,
        sourceId: explain.sourceId || undefined,
        content: context,
        language,
      });
      setMessages((current) => [...current, { id: `${requestId}-assistant`, role: 'assistant', content: data.content, status: 'complete', citations: data.citations ?? [] }]);
    } catch {
      setMessages((current) => [...current, { id: `${requestId}-assistant`, role: 'assistant', content: t('assistant.connectionError'), status: 'failed', citations: [] }]);
    } finally {
      setLoading(false);
    }
  };

  const firstPrompt = `Please explain this question: ${explain.prompt}`;
  useEffect(() => {
    if (initialRequestSent.current) return;
    initialRequestSent.current = true;
    void ask(firstPrompt);
  }, [explain.prompt]);

  return <div className="fixed inset-0 z-40 flex items-end justify-center bg-navy-900/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={t('assistant.title')}>
    <section className="flex max-h-[85dvh] w-full max-w-[26rem] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
      <header className="flex items-center gap-3 bg-navy-800 px-5 py-4 text-white"><Owl variant="waving" className="size-12 shrink-0" /><h2 className="flex-1 text-lg font-bold">{t('assistant.title')}</h2><button type="button" onClick={onClose} className="text-2xl leading-none" aria-label={t('common.close')}>×</button></header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && loading && <div className="flex items-start gap-2"><OwlAvatar /><p className="rounded-2xl bg-tint-100 px-4 py-3 text-sm text-black">{t('assistant.thinking')}</p></div>}
        {messages.map((message) => <MessageBubble key={message.id} message={message} t={(key, params) => key === 'tutor.thinking' ? t('assistant.thinking') : key === 'tutor.failed' ? t('assistant.failed') : t(key, params)} />)}
        {loading && <div className="flex items-start gap-2"><OwlAvatar /><p className="rounded-2xl bg-tint-100 px-4 py-3 text-sm text-black">{t('assistant.thinking')}</p></div>}
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void ask(draft); }} className="flex items-center gap-2 border-t border-tint-200 p-3"><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('assistant.placeholder')} aria-label={t('assistant.placeholder')} className="min-w-0 flex-1 rounded-full border border-tint-200 px-4 py-2.5 text-sm text-black focus:outline-none" /><button type="submit" disabled={!draft.trim() || loading} className="grid size-11 shrink-0 place-items-center rounded-full bg-navy-800 text-white disabled:opacity-50" aria-label={t('assistant.send')}><svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z" /></svg></button></form>
    </section>
  </div>;
};
