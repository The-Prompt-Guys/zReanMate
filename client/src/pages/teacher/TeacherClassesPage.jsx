import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useT } from '../../i18n/index.js';
import { useTeacherDashboard } from './useTeacher.js';
import { ClassArt, Chevron, Progress, SearchField, TeacherButton, TeacherHeader, TeacherIcon, TeacherIconTile } from './TeacherUI.jsx';

export const TeacherClassesPage = () => {
  const t = useT();
  const { data, status } = useTeacherDashboard();
  const [query, setQuery] = useState('');
  const classes = useMemo(() => (data?.classes ?? []).filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase())), [data, query]);
  const totalStudents = (data?.classes ?? []).reduce((sum, item) => sum + (Number(item.studentCount) || 0), 0);

  return (
    <main className="teacher-page min-h-full pb-4">
      <TeacherHeader title={t('teacher.classesTitle')} subtitle={`${data?.summary?.activeClasses ?? classes.length} ${t('teacher.classesShort')} · ${totalStudents} ${t('teacher.studentsShort')}`} owl backTo="/teacher" />
      <div className="space-y-4 px-5 pt-5">
        <div className="flex gap-3">
          <SearchField value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('teacher.searchClasses')} className="flex-1" />
          <button type="button" aria-label={t('teacher.filterClasses')} className="grid size-[3.2rem] shrink-0 place-items-center rounded-2xl bg-white text-[#1555ad] shadow-sm ring-1 ring-[#cfe2f8]">
            <TeacherIcon name="filter" className="size-6" />
          </button>
        </div>

        {status === 'loading' && <LoadingRows />}
        {status !== 'loading' && classes.length === 0 && <EmptyClasses t={t} />}
        <div className="space-y-3">
          {classes.map((klass, index) => {
            const percent = klass.lessonCount ? Math.round(((klass.completedLessons ?? 0) / klass.lessonCount) * 100) : 0;
            return (
              <Link key={klass.id} to={`/teacher/classes/${klass.id}`} className="flex items-center gap-3 rounded-[1.45rem] bg-white p-3 shadow-[0_6px_20px_rgb(18_75_148/0.08)] ring-1 ring-[#dceafb] transition hover:-translate-y-0.5">
                <ClassArt index={index} coverUrl={klass.coverUrl} className="size-[4.55rem]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-extrabold text-[#16458e]">{klass.title}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[#2865bd]"><TeacherIcon name="people" className="size-4" />{klass.studentCount} {t('teacher.students')}</span>
                  <span className="mt-2 flex items-center gap-2"><Progress value={percent} className="flex-1" tone="navy" /><strong className="text-sm text-[#1c4d9e]">{percent}%</strong></span>
                </span>
                <Chevron className="shrink-0 text-[#1555ad]" />
              </Link>
            );
          })}
        </div>
        <Link to="/teacher/classes/new" className="block"><TeacherButton tone="gold" className="w-full"><TeacherIcon name="plus" className="size-6" />{t('teacher.createClass')}</TeacherButton></Link>
      </div>
    </main>
  );
};

const EmptyClasses = ({ t }) => (
  <div className="flex min-h-64 flex-col items-center justify-center rounded-[1.45rem] bg-white px-6 text-center shadow-sm ring-1 ring-[#dceafb]">
    <TeacherIconTile name="cap" className="size-16 rounded-[1.3rem]" iconClassName="size-9" />
    <p className="mt-4 text-lg font-extrabold text-[#16458e]">{t('teacher.noClasses')}</p>
  </div>
);

const LoadingRows = () => <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-[6.8rem] animate-pulse rounded-[1.45rem] bg-[#e7f2fd]" />)}</div>;
