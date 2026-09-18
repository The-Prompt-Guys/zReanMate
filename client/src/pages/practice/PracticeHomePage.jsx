import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useT } from '../../i18n/index.js';
import { api } from '../../lib/api.js';
import { useKits } from '../../kits/KitsContext.jsx';
import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';

export const PracticeHomePage = () => {
  const t = useT();
  const { kits } = useKits();
  const [home, setHome] = useState(null);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/practice/home'), api.get('/practice/progress')]).then(([homeResponse, progressResponse]) => {
      setHome(homeResponse.data);
      setProgress(progressResponse.data);
    });
  }, []);

  const current = home?.continue;
  const modes = [
    ['/practice/setup', t('study.quizMe')],
    ['/practice/setup', t('practice.writeAnswer')],
    [`/flashcards/${kits[0]?.id ?? ''}`, t('practice.flashcards')],
    ['/practice/setup?mock=1', t('practice.mockExam')],
  ];

  return (
    <main>
      <NavyHeader className="flex items-start justify-between">
        <div><h1 className="text-3xl font-bold">{t('practice.title')}</h1><p className="text-white/75">{t('practice.subtitle')}</p></div>
        <Owl variant="default" className="size-20" />
      </NavyHeader>
      <div className="space-y-6 px-5 pt-5">
        {current && <section className="rounded-card bg-tint-100 p-5"><h2 className="text-xl font-bold text-navy-900">{t('practice.continueTitle')}</h2><p className="font-bold text-navy-900">{current.title}</p><p className="text-navy-600">{t('practice.answeredOf', { done: current.answered, total: current.total })}</p><Link to={`/practice/session?sessionId=${current.sessionId}`} className="mt-3 inline-flex rounded-full bg-navy-800 px-5 py-2 font-bold text-white">{t('common.continue')}</Link></section>}
        {!current && progress && !progress.hasActivity && <section className="rounded-card bg-white p-6 text-center ring-1 ring-tint-200"><Owl variant="waving" className="mx-auto size-24" /><h2 className="mt-3 text-xl font-bold text-navy-900">{t('practice.emptyTitle')}</h2><p className="mt-1 text-navy-600">{t('practice.emptyBody')}</p></section>}
        {progress?.hasActivity && <section className="rounded-card bg-tint-100 p-5"><h2 className="text-xl font-bold text-navy-900">{t('practice.progress')}</h2><p className="mt-1 text-navy-700">{t('practice.streak', { count: progress.activityStreak })}</p></section>}
        <section><h2 className="text-xl font-bold text-navy-900">{t('practice.chooseMode')}</h2><ul className="mt-3 space-y-3">{modes.map(([to, title]) => <li key={title}><Link to={to} className="flex items-center justify-between rounded-card bg-white p-4 font-bold text-navy-900 ring-1 ring-tint-200"><span>{title}</span><span aria-hidden="true">-&gt;</span></Link></li>)}</ul></section>
      </div>
    </main>
  );
};
