import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useT } from '../../i18n/index.js';
import { deleteTeacherAssignment, gradeTeacherSubmission, useTeacherAssignment, useTeacherAssignments, useTeacherSubmissions } from './useTeacher.js';
import { Avatar, Chevron, SearchField, StatusPill, TeacherButton, TeacherCard, TeacherHeader, TeacherIcon, TeacherIconTile } from './TeacherUI.jsx';

export const TeacherSubmissionListPage = () => {
  const t = useT();
  const { assignmentId } = useParams();
  const { data } = useTeacherAssignments();
  const { data: detailData } = useTeacherAssignment(assignmentId);
  const { data: submissionData, status } = useTeacherSubmissions(assignmentId);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const navigate = useNavigate();
  const assignment = data?.assignments?.find((item) => item.id === assignmentId);
  const students = useMemo(() => (submissionData?.submissions ?? []).filter((item) => item.studentName.toLowerCase().includes(query.toLowerCase())), [submissionData, query]);
  const submitted = students.length;
  const total = assignment?.studentCount ?? submitted;
  const review = students.filter((item) => ['submitted', 'late'].includes(item.status)).length;
  const returned = students.filter((item) => item.status === 'graded').length;
  const details = detailData?.assignment ?? assignment;
  const remove = async () => {
    if (!window.confirm(t('teacher.deleteAssignmentConfirm', { name: details?.title ?? '' }))) return;
    setDeleteError(null);
    try {
      await deleteTeacherAssignment(assignmentId);
      navigate('/teacher/assignments', { replace: true });
    } catch (cause) {
      setDeleteError(cause?.response?.data?.error?.message ?? t('errors.generic'));
    }
  };
  return <main className="teacher-page min-h-full pb-5"><TeacherHeader backTo="/teacher/assignments" title={details?.title ?? t('teacher.sampleAssignment')} subtitle={details?.className} action={<div className="relative"><button type="button" aria-label={t('teacher.moreActions')} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)} className="grid size-10 place-items-center rounded-full bg-white text-[#1555ad]"><TeacherIcon name="more" className="size-6" /></button>{menuOpen && <div className="absolute right-0 top-12 z-20 min-w-48 rounded-2xl bg-white p-2 text-left shadow-xl ring-1 ring-[#dceafb]"><Link to={`/teacher/assignments/${assignmentId}/edit`} onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2 text-sm font-extrabold text-[#1555ad] hover:bg-[#edf6ff]">{t('teacher.editAssignment')}</Link><button type="button" onClick={() => { setMenuOpen(false); remove(); }} className="block w-full rounded-xl px-3 py-2 text-left text-sm font-extrabold text-danger-600 hover:bg-danger-50">{t('teacher.deleteAssignment')}</button></div>}</div>} /><div className="space-y-4 px-5 pt-5">{deleteError && <p role="alert" className="rounded-xl bg-danger-50 p-3 text-sm font-semibold text-danger-600">{deleteError}</p>}<TeacherCard><div className="flex items-start gap-3"><TeacherIconTile name={details?.type === 'quiz' ? 'check' : 'assignment'} tone={details?.type === 'quiz' ? 'blue' : 'gold'} /><div className="min-w-0 flex-1"><h2 className="text-xl font-extrabold text-[#16458e]">{details?.title}</h2><p className="mt-1 text-sm font-semibold text-[#7b9ed0]">{details?.type === 'quiz' ? t('teacher.quiz') : t('teacher.createAssignment')} · {details?.points ?? 0} {t('teacher.points')}</p><p className="mt-1 text-sm font-semibold text-[#7b9ed0]">{details?.dueAt ? new Date(details.dueAt).toLocaleString() : t('teacher.noDueDate')}</p></div></div>{details?.description && <p className="mt-4 rounded-xl bg-[#f4faff] p-3 text-sm font-semibold text-[#3769b1]">{details.description}</p>}{details?.instructions?.length > 0 && <div className="mt-4"><h3 className="font-extrabold text-[#16458e]">{t('teacher.instructions')}</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold text-[#3769b1]">{details.instructions.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>}</TeacherCard><div className="flex items-center gap-3"><TeacherIconTile name="assignment" /><strong className="text-xl text-[#16458e]">{t('teacher.submittedOf', { done: submitted, total })}</strong></div><div className="grid grid-cols-2 gap-3"><button type="button" className="rounded-full bg-gradient-to-r from-[#ffad32] to-[#ffbf55] px-4 py-3 text-lg font-extrabold text-white">{t('teacher.toReview')} <span className="ml-2 text-2xl">{review}</span></button><button type="button" className="rounded-full bg-[#e9f4ff] px-4 py-3 text-lg font-extrabold text-[#1b55a5]">{t('teacher.returned')} <span className="ml-2 text-2xl">{returned}</span></button></div><div className="flex gap-3"><SearchField value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('teacher.searchStudents')} className="flex-1" /></div>{status === 'loading' && <TeacherCard>{t('common.loading')}</TeacherCard>}<div className="divide-y divide-[#e2eefb] rounded-[1.45rem] bg-white px-4 shadow-sm ring-1 ring-[#dceafb]">{students.map((student) => <Link key={student.id} to={`/teacher/assignments/${assignmentId}/submissions/${student.id}`} className="flex items-center gap-3 py-4"><Avatar name={student.studentName} className="size-13" /><span className="min-w-0 flex-1"><strong className="block truncate text-xl text-[#16458e]">{student.studentName}</strong><span className="mt-1 block text-base font-semibold text-[#80a4dc]">{student.submittedAt ? new Date(student.submittedAt).toLocaleString() : t('teacher.notSubmitted')}</span></span>{student.status === 'graded' ? <StatusPill tone="green">{t('teacher.graded', { score: student.score })}</StatusPill> : <StatusPill tone="gold">{t('teacher.notGraded')}</StatusPill>}<Chevron className="text-[#1555ad]" /></Link>)}</div></div></main>;
};

export const TeacherGradeSubmissionPage = () => {
  const t = useT();
  const { assignmentId, studentId } = useParams();
  const navigate = useNavigate();
  const { data } = useTeacherAssignments();
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState(t('teacher.sampleFeedback'));
  const [rubric, setRubric] = useState([false, false, false]);
  const [error, setError] = useState(null);
  const assignment = data?.assignments?.find((item) => item.id === assignmentId);
  const name = studentId;
  const grade = async () => {
    if (score === '') return;
    try {
      await gradeTeacherSubmission(assignmentId, studentId, { score: Number(score), feedback });
      navigate(`/teacher/assignments/${assignmentId}`, { replace: true });
    } catch (cause) {
      setError(cause?.response?.data?.error?.message ?? t('errors.generic'));
    }
  };
  return <main className="teacher-page min-h-full pb-5"><TeacherHeader backTo={`/teacher/assignments/${assignmentId}`} title={assignment?.title ?? t('teacher.sampleAssignment')} subtitle={assignment?.className} /><div className="space-y-4 px-5 pt-5"><TeacherCard className="flex items-center gap-3"><Avatar name={name} className="size-16" /><span className="min-w-0 flex-1"><strong className="block truncate text-2xl text-[#16458e]">{name}</strong><span className="mt-1 block text-lg font-semibold text-[#80a4dc]">{t('teacher.submittedAgo', { when: t('teacher.hoursAgo') })}</span></span><StatusPill tone="gold">{t('teacher.notGraded')}</StatusPill></TeacherCard><TeacherCard className="bg-[#f4faff]"><div className="flex items-start gap-3"><TeacherIconTile name="document" /><span className="min-w-0 flex-1"><strong className="block text-lg text-[#17488f]">{name} — {assignment?.title ?? t('teacher.sampleAssignment')}.pdf</strong><span className="mt-1 block text-sm font-semibold text-[#80a4dc]">{t('teacher.fileUploaded', { when: t('teacher.hoursAgo') })}</span></span></div><div className="mt-4 grid grid-cols-2 gap-3"><TeacherButton tone="outline"><TeacherIcon name="eye" className="size-5" />{t('teacher.preview')}</TeacherButton><TeacherButton tone="outline"><TeacherIcon name="download" className="size-5" />{t('teacher.download')}</TeacherButton></div></TeacherCard><TeacherCard><label className="block text-xl font-extrabold text-[#16458e]">{t('teacher.score')}<span className="relative mt-3 block"><input type="number" min="0" max={assignment?.points ?? 100} value={score} onChange={(event) => setScore(event.target.value)} placeholder="—" className="w-full rounded-2xl border border-[#bad9fb] px-5 py-4 text-3xl font-extrabold text-[#16458e] outline-none focus:ring-2 focus:ring-[#0878f9]" /><span className="absolute right-5 top-1/2 -translate-y-1/2 text-2xl font-bold text-[#8dacdf]">{t('teacher.scoreOutOf', { points: assignment?.points ?? 100 })}</span></span></label><h2 className="mt-6 text-xl font-extrabold text-[#16458e]">{t('teacher.rubric')}</h2><div className="mt-3 grid gap-2 sm:grid-cols-3">{['showsWorking', 'correctMethod', 'clearPresentation'].map((key, index) => <label key={key} className="flex items-start gap-2 text-sm font-semibold text-[#285ba5]"><input type="checkbox" checked={rubric[index]} onChange={() => setRubric((items) => items.map((item, itemIndex) => itemIndex === index ? !item : item))} className="mt-0.5 size-5 accent-[#0878f9]" />{t(`teacher.${key}`)}</label>)}</div><TeacherButton tone="outline" className="mt-5 w-full"><TeacherIcon name="sparkle" className="size-5" />{t('teacher.suggestedFeedback')}</TeacherButton><label className="mt-5 block text-xl font-extrabold text-[#16458e]">{t('teacher.comment')}<textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={3} className="mt-3 w-full resize-none rounded-2xl border border-[#bad9fb] p-4 text-base font-semibold text-[#24549a] outline-none focus:ring-2 focus:ring-[#0878f9]" /></label>{error && <p role="alert" className="mt-4 rounded-xl bg-danger-50 p-3 text-sm font-semibold text-danger-600">{error}</p>}<TeacherButton onClick={grade} disabled={!score} className="mt-5 w-full"><TeacherIcon name="assignment" className="size-5" />{t('teacher.returnToStudent')}</TeacherButton><button type="button" onClick={() => navigate(-1)} className="mt-3 w-full py-2 text-base font-extrabold text-[#155dcc]">{t('teacher.saveDraft')}</button></TeacherCard></div></main>;
};
