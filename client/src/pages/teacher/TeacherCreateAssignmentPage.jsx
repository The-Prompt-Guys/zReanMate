import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { useLanguage, useT } from '../../i18n/index.js';
import { createTeacherAssignment, createTeacherQuiz, updateTeacherAssignment, uploadTeacherAssignmentAttachment, useTeacherAssignment, useTeacherDashboard } from './useTeacher.js';
import { TeacherButton, TeacherCard, TeacherHeader, TeacherIcon, TeacherIconTile, TeacherToggle } from './TeacherUI.jsx';

export const TeacherCreateAssignmentPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { assignmentId } = useParams();
  const editMode = Boolean(assignmentId);
  const { data: assignmentData } = useTeacherAssignment(assignmentId);
  const existing = assignmentData?.assignment;
  const quizMode = location.pathname.includes('quizzes') || new URLSearchParams(location.search).get('type') === 'quiz' || existing?.type === 'quiz';
  const requestedClassId = new URLSearchParams(location.search).get('classId') ?? '';
  const { data } = useTeacherDashboard();
  const [classId, setClassId] = useState(requestedClassId);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [points, setPoints] = useState('100');
  const [count, setCount] = useState(10);
  const [questions, setQuestions] = useState([]);
  const [notify, setNotify] = useState(true);
  const [late, setLate] = useState(true);
  const [attachment, setAttachment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const attachmentInput = useRef(null);
  useEffect(() => {
    if (!existing) return;
    setClassId(existing.classId ?? '');
    setTitle(existing.title ?? '');
    setInstructions(existing.description ?? existing.instructions?.[0] ?? '');
    setDueAt(existing.dueAt ? new Date(existing.dueAt).toISOString().slice(0, 16) : '');
    setPoints(String(existing.points ?? 0));
  }, [existing]);
  const classes = data?.classes ?? [];
  const selected = classes.find((item) => item.id === classId) ?? classes[0];
  const returnToClasswork = selected?.id ? `/teacher/classes/${selected.id}?tab=classwork` : '/teacher/assignments';
  const typeTitle = quizMode ? t('teacher.createQuiz') : t('teacher.createAssignment');

  const save = async (publish) => {
    if (!selected || !title.trim()) return;
    if (quizMode) {
      const incomplete = questions.findIndex((question) =>
        !question.prompt.trim() ||
        (question.options.length > 0 && question.options.some((option) => !option.trim())));
      if (incomplete >= 0) {
        setError(t('teacher.completeQuestion', { number: incomplete + 1 }));
        return;
      }
      setBusy(true); setError(null);
      try {
        await createTeacherQuiz({
          classId: selected.id,
          title: title.trim(),
          language,
          count,
          questions: questions.map((question) => ({
            kind: question.type === 'multipleChoice' ? 'multiple_choice' : question.type === 'trueFalse' ? 'true_false' : 'short_answer',
            prompt: question.prompt.trim(),
            options: question.options,
            correctAnswer: question.options.length ? question.correctIndex : question.prompt.trim(),
            explanation: '',
          })),
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          points: Number(points) || 0,
          publish,
        });
        navigate(returnToClasswork);
      } catch (cause) { setError(cause?.response?.data?.error?.message ?? t('errors.generic')); } finally { setBusy(false); }
      return;
    }
    setBusy(true); setError(null);
    try {
      if (editMode) {
        await updateTeacherAssignment(assignmentId, {
          title: title.trim(),
          description: instructions.trim() || undefined,
          instructions: instructions.trim() ? [instructions.trim()] : [],
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          points: Number(points) || 0,
          publish,
        });
        navigate(`/teacher/assignments/${assignmentId}`);
        return;
      }
      const assignment = await createTeacherAssignment({ classId: selected.id, title: title.trim(), description: instructions.trim() || undefined, instructions: instructions.trim() ? [instructions.trim()] : [], dueAt: dueAt ? new Date(dueAt).toISOString() : null, points: Number(points) || 0, type: 'file', publish });
      if (attachment) await uploadTeacherAssignmentAttachment(assignment.id, attachment);
      navigate(returnToClasswork);
    } catch (cause) { setError(cause?.response?.data?.error?.message ?? t('errors.generic')); } finally { setBusy(false); }
  };

  return <main className="teacher-page min-h-full pb-5"><TeacherHeader backTo={editMode ? `/teacher/assignments/${assignmentId}` : returnToClasswork} title={editMode ? t('teacher.editAssignment') : typeTitle} action={<button type="button" onClick={() => save(false)} disabled={busy} className="rounded-full bg-[#ffad32] px-3 py-2 text-sm font-extrabold text-white disabled:opacity-50">{t('teacher.saveDraft')}</button>} /><form onSubmit={(event) => { event.preventDefault(); save(true); }} className="space-y-5 px-5 pt-5"><label className="block"><span className="mb-2 block text-xl font-extrabold text-[#16458e]">{t('teacher.selectClassLabel')}</span><span className="relative flex items-center rounded-[1.35rem] bg-white p-3 shadow-sm ring-1 ring-[#dceafb]"><TeacherIconTile name="cap" /><select disabled={editMode} value={selected?.id ?? ''} onChange={(event) => setClassId(event.target.value)} className="ml-3 min-w-0 flex-1 appearance-none bg-transparent pr-8 text-lg font-extrabold text-[#17488f] outline-none">{classes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><TeacherIcon name="down" className="pointer-events-none absolute right-4 size-5 text-[#1555ad]" /></span></label><Field label={quizMode ? t('teacher.quiz') + ' ' + t('teacher.title').toLowerCase() : t('teacher.assignmentTitle')} icon="edit"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={quizMode ? t('teacher.createQuiz') : t('teacher.exampleAssignment')} required className="teacher-input" /></Field><Field label={t('teacher.instructions')} icon="document"><textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} placeholder={t('teacher.instructions')} className="teacher-input resize-none" /></Field><div className="grid grid-cols-2 gap-3"><Field label={t('teacher.dueDate')} icon="calendar"><input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="teacher-input text-sm" /></Field><Field label={quizMode ? t('teacher.timeLimit') : t('teacher.points')} icon={quizMode ? 'clock' : 'sparkle'}>{quizMode ? <select className="teacher-input" defaultValue="30"><option value="30">{t('teacher.minutes30')}</option></select> : <input type="number" min="0" value={points} onChange={(event) => setPoints(event.target.value)} className="teacher-input" />}</Field></div>{!editMode && (quizMode ? <QuizQuestions t={t} count={count} setCount={setCount} questions={questions} setQuestions={setQuestions} /> : <Attachment t={t} attachment={attachment} inputRef={attachmentInput} onChange={(event) => { const file = event.target.files?.[0] ?? null; setAttachment(file); event.target.value = ''; }} onRemove={() => setAttachment(null)} />)}<TeacherCard><h2 className="text-xl font-extrabold text-[#16458e]">{t('teacher.settings')}</h2><div className="mt-2 divide-y divide-[#e2eefb]"><TeacherToggle id="notify" checked={notify} onChange={() => setNotify((value) => !value)} label={t('teacher.notifyStudents')} />{quizMode ? <TeacherToggle id="results" checked={late} onChange={() => setLate((value) => !value)} label={t('teacher.showResults')} /> : <TeacherToggle id="late" checked={late} onChange={() => setLate((value) => !value)} label={t('teacher.allowLateSubmissions')} />}</div></TeacherCard>{error && <p role="alert" className="rounded-xl bg-danger-50 p-3 text-sm font-semibold text-danger-600">{error}</p>}<div className="grid grid-cols-[1.2fr_1fr] gap-3 pb-3"><TeacherButton tone="gold" className="w-full" disabled={busy || !selected || !title.trim()} onClick={() => save(true)}>{editMode ? t('teacher.saveChanges') : typeTitle}</TeacherButton><TeacherButton tone="outline" className="w-full" disabled={busy} onClick={() => save(false)}>{t('teacher.saveAsDraft')}</TeacherButton></div>{quizMode && !editMode && <p className="text-center text-sm font-semibold text-[#7b9ed0]">{t('teacher.aiDisclaimer')}</p>}</form></main>;
};

const Field = ({ label, icon, children }) => <label className="block"><span className="mb-2 block text-xl font-extrabold text-[#16458e]">{label}</span><span className="flex items-start gap-3 rounded-[1.35rem] bg-white p-3 shadow-sm ring-1 ring-[#dceafb]"><TeacherIconTile name={icon} className="size-11 rounded-xl" iconClassName="size-5" /><span className="min-w-0 flex-1">{children}</span></span></label>;

const Attachment = ({ t, attachment, inputRef, onChange, onRemove }) => <label htmlFor="assignment-attachment" className="flex cursor-pointer items-center gap-3 rounded-[1.35rem] bg-white p-4 shadow-sm ring-1 ring-[#dceafb]"><TeacherIconTile name="plus" /><span className="min-w-0 flex-1"><strong className="block truncate text-lg text-[#17488f]">{attachment?.name ?? t('teacher.addAttachment')}</strong><span className="block text-sm font-semibold text-[#7c9fd4]">{attachment ? `${Math.ceil(attachment.size / 1024)} KB` : t('teacher.attachmentHint')}</span></span>{attachment ? <button type="button" onClick={(event) => { event.preventDefault(); onRemove(); }} className="text-sm font-bold text-[#1555ad]">{t('teacher.removeAttachment')}</button> : <TeacherIcon name="clip" className="size-6 text-[#1555ad]" />}<input ref={inputRef} id="assignment-attachment" type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={onChange} /></label>;

const QuizQuestions = ({ t, count, setCount, questions, setQuestions }) => {
  const addQuestion = (type) => {
    const options = type === 'multipleChoice' ? ['', '', '', ''] : type === 'trueFalse' ? ['True', 'False'] : [];
    setQuestions((items) => [...items, { id: crypto.randomUUID(), type, prompt: '', options, correctIndex: 0 }]);
    setCount((value) => Math.max(value, questions.length + 1));
  };
  return <><Field label={t('teacher.numberOfQuestions')} icon="document"><span className="flex items-center gap-3"><button type="button" onClick={() => setCount((value) => Math.max(1, value - 1))} className="grid size-8 place-items-center rounded-full bg-[#e9f4ff] text-xl font-bold text-[#1555ad]">−</button><strong className="flex-1 text-center text-lg text-[#17488f]">{count}</strong><button type="button" onClick={() => setCount((value) => Math.min(30, value + 1))} className="grid size-8 place-items-center rounded-full bg-[#e9f4ff] text-xl font-bold text-[#1555ad]">+</button></span></Field><TeacherCard className="text-center"><TeacherIconTile name="plus" className="mx-auto size-16 rounded-full" iconClassName="size-9" /><h2 className="mt-3 text-xl font-extrabold text-[#16458e]">{questions.length ? `${questions.length} ${t('teacher.questions')}` : t('teacher.addFirstQuestion')}</h2><p className="mt-1 font-semibold text-[#80a4dc]">{t('teacher.addQuestionHint')}</p><div className="mt-4 flex flex-wrap justify-center gap-2">{[['multipleChoice', 'multipleChoice'], ['trueFalse', 'trueFalse'], ['shortAnswer', 'shortAnswer']].map(([type, key]) => <button key={type} type="button" onClick={() => addQuestion(type)} className="rounded-full border border-[#badafb] px-3 py-2 text-sm font-bold text-[#0d68d1]">+ {t(`teacher.${key}`)}</button>)}</div></TeacherCard>{questions.map((question, index) => <TeacherCard key={question.id}><div className="flex items-center justify-between"><h3 className="font-extrabold text-[#16458e]">{index + 1}. {t(`teacher.${question.type}`)}</h3><button type="button" onClick={() => setQuestions((items) => items.filter((item) => item.id !== question.id))} className="text-sm font-bold text-[#1555ad]">{t('teacher.removeAttachment')}</button></div><textarea value={question.prompt} onChange={(event) => setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, prompt: event.target.value } : item))} placeholder={t('teacher.questionPrompt')} rows={2} className="teacher-input mt-3 resize-none" />{question.options.length > 0 && <div className="mt-3 space-y-2">{question.options.map((option, optionIndex) => <div key={`${question.id}-${optionIndex}`} className="flex items-center gap-2"><input type="radio" name={`correct-${question.id}`} checked={question.correctIndex === optionIndex} onChange={() => setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, correctIndex: optionIndex } : item))} aria-label={`${t('teacher.correctAnswer')} ${optionIndex + 1}`} className="size-4 accent-[#1555ad]" /><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#eaf3ff] text-sm font-extrabold text-[#1555ad]">{String.fromCharCode(65 + optionIndex)}</span><input value={option} onChange={(event) => setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, options: item.options.map((value, index) => index === optionIndex ? event.target.value : value) } : item))} placeholder={`${t('teacher.option')} ${optionIndex + 1}`} className="teacher-input" /></div>)}</div>}</TeacherCard>)}</>;
};

const Chevron = () => <TeacherIcon name="chevron" className="size-5 text-[#1555ad]" />;
