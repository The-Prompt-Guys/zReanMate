import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useT } from '../../i18n/index.js';
import { deleteTeacherAssignment, useTeacherAssignments } from './useTeacher.js';
import { Chevron, Progress, SearchField, StatusPill, TeacherButton, TeacherHeader, TeacherIcon, TeacherIconTile } from './TeacherUI.jsx';

export const TeacherAssignmentsPage = () => {
  const t = useT();
  const { data, status } = useTeacherAssignments();
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const assignments = data?.assignments ?? [];
  const classes = [...new Map(assignments.map((item) => [item.classId, item.className])).entries()];
  const visible = useMemo(() => assignments.filter((item) => `${item.title} ${item.className}`.toLowerCase().includes(query.toLowerCase()) && (!classFilter || item.classId === classFilter)), [assignments, query, classFilter]);
  const toReview = assignments.reduce((sum, item) => sum + (Number(item.pendingCount) || 0), 0);
  const returned = assignments.reduce((sum, item) => sum + (Number(item.gradedCount) || 0), 0);

  return <main className="teacher-page min-h-full pb-5"><TeacherHeader title={t('teacher.assignmentsTitle')} subtitle={t('teacher.assignmentsSubtitle')} /><div className="space-y-4 px-5 pt-5"><div className="flex gap-3"><SearchField value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('teacher.searchAssignments')} className="flex-1" /><label className="relative w-32 shrink-0"><span className="sr-only">{t('teacher.allClasses')}</span><select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="h-full w-full appearance-none rounded-full bg-white px-4 pr-9 text-sm font-extrabold text-[#17488f] shadow-sm ring-1 ring-[#cfe2f8] outline-none"><option value="">{t('teacher.allClasses')}</option>{classes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><TeacherIcon name="down" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#1555ad]" /></label></div><div className="grid grid-cols-2 gap-3"><SummaryCard tone="gold" icon="document" label={t('teacher.toReview')} value={toReview} /><SummaryCard tone="blue" icon="check" label={t('teacher.returned')} value={returned} /></div>{status === 'loading' && <div className="space-y-3">{[1, 2, 3].map((key) => <div key={key} className="h-36 animate-pulse rounded-[1.45rem] bg-[#e7f2fd]" />)}</div>}<div className="space-y-3">{visible.map((assignment) => <AssignmentCard key={assignment.id} assignment={assignment} t={t} />)}</div>{status !== 'loading' && !visible.length && <div className="rounded-[1.45rem] bg-white p-10 text-center shadow-sm ring-1 ring-[#dceafb]"><TeacherIconTile name="assignment" className="mx-auto size-16" iconClassName="size-9" /><p className="mt-4 font-bold text-[#7196cc]">{t('teacher.noDueDate')}</p></div>}<Link to="/teacher/assignments/new" className="block"><TeacherButton className="w-full"><TeacherIcon name="plus" className="size-6" />{t('teacher.createAssignment')}</TeacherButton></Link></div></main>;
};

const SummaryCard = ({ tone, icon, label, value }) => <div className={`rounded-[1.4rem] p-4 ${tone === 'gold' ? 'bg-gradient-to-br from-[#ffad32] to-[#ffc35a] text-white' : 'bg-[#e7f3ff] text-[#1953a4]'}`}><div className="flex items-center gap-3"><span className={`grid size-11 place-items-center rounded-full ${tone === 'gold' ? 'bg-white/30' : 'bg-white'} `}><TeacherIcon name={icon} className="size-6" /></span><span><strong className="block text-3xl leading-none">{value}</strong><span className="mt-1 block text-base font-bold">{label}</span></span></div></div>;

const AssignmentCard = ({ assignment, t }) => {
  const [open, setOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const percent = assignment.studentCount ? Math.round((assignment.submissionCount / assignment.studentCount) * 100) : 0;
  if (deleted) return null;
  const remove = async () => {
    if (!window.confirm(t('teacher.deleteAssignmentConfirm', { name: assignment.title }))) return;
    await deleteTeacherAssignment(assignment.id);
    setDeleted(true);
  };
  return <div className="relative rounded-[1.45rem] bg-white p-4 shadow-[0_6px_20px_rgb(18_75_148/0.08)] ring-1 ring-[#dceafb] transition hover:-translate-y-0.5"><div className="flex items-start gap-3"><Link to={`/teacher/assignments/${assignment.id}`} className="flex min-w-0 flex-1 items-start gap-3"><TeacherIconTile name={assignment.type === 'quiz' ? 'check' : 'assignment'} tone={assignment.type === 'quiz' ? 'blue' : 'gold'} /><span className="min-w-0 flex-1"><strong className="block truncate text-lg text-[#16458e]">{assignment.title}</strong><span className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[#7a9ed2]"><TeacherIcon name="cap" className="size-4" />{assignment.className}</span><span className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[#7a9ed2]"><TeacherIcon name="calendar" className="size-4" />{assignment.dueAt ? new Date(assignment.dueAt).toLocaleDateString() : t('teacher.noDueDate')}</span></span></Link><div className="flex shrink-0 items-start gap-1"><StatusPill>{t('teacher.review')}<Chevron className="size-4" /></StatusPill><div className="relative"><button type="button" aria-label={t('teacher.moreActions')} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="grid size-9 place-items-center rounded-full text-[#1555ad] hover:bg-[#edf6ff]"><TeacherIcon name="more" className="size-5" /></button>{open && <div className="absolute right-0 top-10 z-20 min-w-48 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-[#dceafb]"><Link to={`/teacher/assignments/${assignment.id}/edit`} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-sm font-extrabold text-[#1555ad] hover:bg-[#edf6ff]">{t('teacher.editAssignment')}</Link><button type="button" onClick={() => { setOpen(false); remove(); }} className="block w-full rounded-xl px-3 py-2 text-left text-sm font-extrabold text-danger-600 hover:bg-danger-50">{t('teacher.deleteAssignment')}</button></div>}</div></div></div><Link to={`/teacher/assignments/${assignment.id}`} className="block"><p className="mt-4 text-sm font-extrabold text-[#1753a5]">{t('teacher.submittedOf', { done: assignment.submissionCount, total: assignment.studentCount })}</p><Progress value={percent} className="mt-2" /></Link></div>;
};
