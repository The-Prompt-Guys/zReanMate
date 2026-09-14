import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext.jsx';
import { StudyTabBar } from '../../components/StudyTabBar.jsx';
import { CheckIcon } from '../../components/ui.jsx';
import { useLanguage, useT } from '../../i18n/index.js';
import { useKits } from '../../kits/KitsContext.jsx';
import { api } from '../../lib/api.js';
import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';

export const QuizResultsPage = () => {
  const t = useT(); const { language } = useLanguage(); const { user } = useAuth();
  const { kitId } = useParams(); const [params] = useSearchParams(); const { getKit } = useKits();
  const [attempt, setAttempt] = useState(null);
  const kit = getKit(kitId); const title = language === 'km' ? (kit?.titleKm || kit?.title) : kit?.title;
  useEffect(() => { const id = params.get('attemptId') || window.localStorage.getItem(`reanmate:quiz-attempt:${kitId}:${language}`); if (id) api.get(`/attempts/${id}`).then(({ data }) => setAttempt(data.attempt)).catch(() => {}); }, [params, kitId, language]);
  const mastery = attempt?.mastery ?? 0;
  return <main className="flex min-h-dvh flex-col"><NavyHeader className="shrink-0"><div className="flex items-start gap-3"><Link to={`/kits/${kitId}`} aria-label={t('common.back')} className="mt-1 shrink-0"><svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></Link><div><h1 className="text-2xl font-bold">{t('quiz.completeTitle')}</h1><p className="text-white/75">{title}</p></div></div></NavyHeader><div className="flex-1 px-5 pt-6"><div className="flex flex-col items-center text-center"><Owl variant="waving" className="size-28" /><h2 className="mt-3 text-3xl font-bold text-navy-900">{t('quiz.niceWork', { name: user?.full_name ?? '' })}</h2><div className="mt-5 grid size-40 place-items-center rounded-full bg-navy-800 text-4xl font-bold text-white">{attempt?.correct ?? 0} / {attempt?.total ?? 0}</div><p className="mt-3 text-navy-600">{t('quiz.correctAnswers')}</p></div><section className="mt-6 rounded-card bg-white p-5 shadow-sm ring-1 ring-tint-200/70"><h3 className="text-xl font-bold text-navy-900">{t('quiz.takeaways')}</h3><ul className="mt-3 divide-y divide-tint-200">{(attempt?.takeaways ?? []).map((takeaway) => <li key={takeaway} className="flex items-center gap-3 py-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy-800"><CheckIcon /></span><span className="text-navy-700">{takeaway}</span></li>)}</ul></section><section className="mt-4 flex items-center gap-4 rounded-card bg-tint-100 p-5"><MasteryRing percent={mastery} /><div><p className="text-xl font-bold text-navy-900">{t('quiz.mastery', { percent: mastery })}</p><p className="text-sm text-navy-600">{t('quiz.masteryHint')}</p></div></section><div className="mt-6 text-center"><Link to={`/kits/${kitId}`} className="font-semibold text-navy-800">{t('quiz.backToKit')}</Link></div></div><StudyTabBar kitId={kitId} active="practice" /></main>;
};

const MasteryRing = ({ percent }) => { const radius = 26; const circumference = 2 * Math.PI * radius; const filled = (percent / 100) * circumference; return <span className="relative grid size-[4.5rem] shrink-0 place-items-center"><svg viewBox="0 0 64 64" className="size-full -rotate-90" aria-hidden="true"><circle cx="32" cy="32" r={radius} fill="none" stroke="#DCE9FB" strokeWidth="7" /><circle cx="32" cy="32" r={radius} fill="none" stroke="#0C3C85" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${filled} ${circumference}`} /></svg><span className="absolute text-sm font-bold text-navy-900">{percent}%</span></span>; };
