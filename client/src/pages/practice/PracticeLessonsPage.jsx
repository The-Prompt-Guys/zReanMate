import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { SearchField } from '../../components/listControls.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { Button } from '../../components/ui.jsx';
import { useT } from '../../i18n/index.js';
import { api, toFormError } from '../../lib/api.js';
import { NavyHeader } from '../../layouts/AppLayout.jsx';

export const PracticeLessonsPage = () => {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sourceId = params.get('sourceId');
  const kitId = params.get('kitId');
  const setup = JSON.parse(window.sessionStorage.getItem('reanmate:practice-setup') || 'null');
  const [query, setQuery] = useState('');
  const [topics, setTopics] = useState([]);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);

  const createSession = async (topicIds = selected) => {
    if (!setup || starting) return;
    setStarting(true);
    try {
      const { data } = await api.post('/practice/sessions', {
        ...setup,
        ...(setup.mode === 'mock_exam' && { answerFormat: 'multiple_choice', topicIds: [] }),
        ...(setup.mode !== 'mock_exam' && { topicIds }),
      });
      window.localStorage.setItem('reanmate:practice-session', data.session.id);
      navigate(`/practice/session?sessionId=${data.session.id}`, { replace: true });
    } catch (err) {
      setError(toFormError(err));
      setStarting(false);
    }
  };

  useEffect(() => {
    if (setup?.mode === 'mock_exam') {
      createSession([]);
      return;
    }
    api.get('/practice/topics', { params: { q: query || undefined, sourceId: sourceId || undefined } })
      .then(({ data }) => setTopics(data.topics))
      .catch((err) => setError(toFormError(err)));
  }, [query, sourceId]);

  if (setup?.mode === 'mock_exam') {
    return <main className="grid min-h-dvh place-items-center px-6 text-center"><div><Owl variant="reading" className="mx-auto size-24" /><p className="mt-3 font-semibold text-navy-900">{t('practice.mockExam')}</p><p className="mt-1 text-navy-600">{t('common.loading')}</p></div></main>;
  }

  return (
    <main>
      <NavyHeader className="flex items-start justify-between">
        <div className="flex gap-3">
          <Link to={sourceId ? `/practice/setup?kitId=${encodeURIComponent(kitId ?? '')}&sourceId=${encodeURIComponent(sourceId)}` : '/practice/setup'} aria-label={t('common.back')}>←</Link>
          <div><h1 className="text-2xl font-bold">{t('practice.chooseLesson')}</h1><p className="text-white/75">{t('practice.chooseLessonHint')}</p></div>
        </div>
        <Owl variant="default" className="size-16" />
      </NavyHeader>
      <div className="space-y-4 px-5 pt-4">
        <SearchField value={query} onChange={setQuery} placeholder={t('practice.searchLessons')} label={t('practice.searchLessons')} />
        {error && <p className="text-danger-600">{error.code === 'quota_exceeded' ? t('practice.weeklyLimit') : t('practice.loadFailed')}</p>}
        <ul className="space-y-3">
          {topics.map((topic) => {
            const active = selected.includes(topic.id);
            return <li key={topic.id}><label className="flex cursor-pointer items-center gap-3 rounded-card bg-white p-4 ring-1 ring-tint-200"><input type="checkbox" checked={active} onChange={() => setSelected((items) => active ? items.filter((id) => id !== topic.id) : [...items, topic.id])} /><span className="min-w-0 flex-1"><strong className="block text-base text-navy-900">{topic.title}</strong><span className="text-sm text-brand-600">{topic.recommended ? t('practice.recommended') : t('practice.newTopic')}</span></span></label></li>;
          })}
        </ul>
        <Button disabled={starting} onClick={() => createSession()}>{starting ? t('common.loading') : t('common.continue')}</Button>
      </div>
    </main>
  );
};
