import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext.jsx';
import { useLanguage, useT } from '../../i18n/index.js';
import { askTeacherAssistant, clearTeacherAssistantHistory, createTeacherQuiz, generateTeacherQuiz, uploadTeacherMaterial, useTeacherAssistantHistory, useTeacherClassStudents, useTeacherDashboard, useTeacherMaterials } from './useTeacher.js';
import { Avatar, Chevron, Progress, StatusPill, TeacherButton, TeacherCard, TeacherHeader, TeacherIcon, TeacherIconTile, TeacherToggle } from './TeacherUI.jsx';

export const TeacherAssistantPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data } = useTeacherDashboard();
  const [classId, setClassId] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [busy, setBusy] = useState(false);
  const view = new URLSearchParams(location.search).get('view') ?? 'home';
  const classes = data?.classes ?? [];
  const selectedClass = classes.find((item) => item.id === classId);
  const name = user?.full_name ?? user?.fullName ?? t('teacher.defaultName');

  const open = (next, state) => navigate(`/teacher/assistant?view=${next}`, state ? { state } : undefined);
  const ask = async () => {
    if (!question.trim()) return;
    const content = question.trim();
    setQuestion(''); setMessages((items) => [...items, { role: 'user', content }]); setBusy(true);
    try {
      const response = await askTeacherAssistant({ classId: classId || undefined, conversationId: conversationId || undefined, content, language });
      setConversationId(response.conversationId);
      setMessages((items) => [...items, { role: 'assistant', content: response.content }]);
    } catch {
      setMessages((items) => [...items, { role: 'assistant', content: t('assistant.failed') }]);
    } finally { setBusy(false); }
  };

  if (view === 'history') return <ChatHistory t={t} close={() => open('home')} />;
  if (view === 'generate-assignment' || view === 'generate-quiz') return <GenerateDraft t={t} classes={classes} initialClassId={classId} isQuiz={view === 'generate-quiz'} onBack={() => open('home')} onDone={(draft) => open(view === 'generate-quiz' ? 'edit-quiz' : 'edit-assignment', { draft })} />;
  if (view === 'edit-assignment' || view === 'edit-quiz') return <DraftEditor t={t} isQuiz={view === 'edit-quiz'} draft={location.state?.draft} onBack={() => open('home')} />;
  if (view === 'performance') return <PerformanceReview t={t} classes={classes} onBack={() => open('home')} />;
  if (view === 'chat' || messages.length) return <ChatWorkspace t={t} name={name} classes={classes} classId={classId} setClassId={setClassId} selectedClass={selectedClass} messages={messages} busy={busy} question={question} setQuestion={setQuestion} ask={ask} close={() => open('home')} />;
  return <AssistantHome t={t} name={name} open={open} startChat={() => open('chat')} />;
};

const AssistantHome = ({ t, open, startChat }) => <main className="teacher-page min-h-full"><TeacherHeader backTo="/teacher" title={t('teacher.assistantTitle')} subtitle={t('teacher.assistantSubtitle')} owl /><div className="space-y-5 px-5 pt-6"><div className="flex items-center justify-between"><div><h2 className="text-2xl font-extrabold text-[#16458e]">{t('teacher.howCanHelp')}</h2><p className="mt-1 text-base font-semibold text-[#779bd2]">{t('teacher.planningHint')}</p></div><button type="button" aria-label={t('teacher.chatHistory')} onClick={() => open('history')} className="grid size-12 place-items-center rounded-full bg-[#e9f4ff] text-[#1459b0]"><TeacherIcon name="clock" className="size-6" /></button></div><button type="button" onClick={startChat} className="flex w-full items-center gap-3 rounded-full bg-[#eaf5ff] px-5 py-4 text-left shadow-sm ring-1 ring-[#d9eafa]"><TeacherIcon name="sparkle" className="size-7 text-[#076ee1]" /><span className="flex-1 text-lg font-bold text-[#7197d0]">{t('teacher.assistantPlaceholder')}</span><TeacherIcon name="chevron" className="size-5 text-[#1760b8]" /></button><h2 className="pt-2 text-2xl font-extrabold text-[#16458e]">{t('teacher.quickActions')}</h2><div className="grid grid-cols-2 gap-3"><ActionCard className="col-span-2" icon="assignment" label={t('teacher.createAssignment')} onClick={() => open('generate-assignment')} /><ActionCard icon="chart" label={t('teacher.reviewPerformance')} onClick={() => open('performance')} /><ActionCard icon="check" label={t('teacher.generateQuiz')} onClick={() => open('generate-quiz')} /></div></div></main>;

const ActionCard = ({ icon, label, className = '', onClick }) => <button type="button" onClick={onClick} className={`flex min-h-28 items-center gap-4 rounded-[1.45rem] bg-white p-4 text-left shadow-[0_6px_20px_rgb(18_75_148/0.08)] ring-1 ring-[#dceafb] transition hover:-translate-y-0.5 ${className}`}><TeacherIconTile name={icon} /><strong className="max-w-36 text-xl leading-tight text-[#17488f]">{label}</strong></button>;

const ChatHistory = ({ t, close }) => {
  const { data, refresh } = useTeacherAssistantHistory();
  const [error, setError] = useState(null);
  const clear = async () => {
    if (!window.confirm(t('teacher.clearChatConfirm'))) return;
    try { await clearTeacherAssistantHistory(); refresh(); } catch (cause) { setError(cause?.response?.data?.error?.message ?? t('errors.generic')); }
  };
  const rows = data?.conversations ?? [];
  return <main className="teacher-page min-h-full"><TeacherHeader title={t('teacher.assistantTitle')} backTo="/teacher" /><div className="space-y-4 px-5 pt-5"><div className="flex items-center justify-between"><div><h2 className="text-3xl font-extrabold text-[#16458e]">{t('teacher.chatHistory')}</h2><p className="mt-1 font-semibold text-[#779bd2]">{t('teacher.continueConversation')}</p></div><button type="button" onClick={close} aria-label={t('common.close')}><TeacherIcon name="close" className="size-7 text-[#1555ad]" /></button></div>{error && <p role="alert" className="rounded-xl bg-danger-50 p-3 text-sm font-semibold text-danger-600">{error}</p>}<div className="space-y-3">{rows.map((row) => <button type="button" onClick={close} key={row.id} className="flex w-full items-center gap-3 rounded-[1.35rem] bg-[#f2f8ff] p-4 text-left ring-1 ring-[#deebfa]"><TeacherIconTile name="sparkle" /><span className="min-w-0 flex-1"><strong className="block truncate text-lg text-[#17488f]">{row.classTitle ?? t('teacher.noClassSelected')}</strong><span className="mt-1 block truncate text-base font-semibold text-[#80a4dc]">{row.lastContent}</span></span><span className="text-sm font-semibold text-[#80a4dc]">{row.lastMessageAt ? new Date(row.lastMessageAt).toLocaleDateString() : ''}</span><Chevron className="text-[#1555ad]" /></button>)}</div>{!rows.length && <TeacherCard className="py-8 text-center font-semibold text-[#7a9ed2]">{t('teacher.noChatHistory')}</TeacherCard>}<button type="button" onClick={clear} className="w-full pt-4 text-lg font-extrabold text-[#e15468]">{t('teacher.clearChatHistory')}</button></div></main>;
};

const ChatWorkspace = ({ t, name, classes, classId, setClassId, selectedClass, messages, busy, question, setQuestion, ask, close }) => {
  const suggested = messages.length === 0;
  return <main className="teacher-page flex min-h-full flex-col"><TeacherHeader backTo="/teacher" title={t('teacher.assistantTitle')} action={<button type="button" onClick={close} aria-label={t('common.close')} className="hidden" />} compact /><div className="flex flex-1 flex-col px-5 pb-4 pt-5"><label className="relative flex items-center rounded-full bg-[#eaf5ff] px-4 py-3"><TeacherIcon name="cap" className="size-6 text-[#1555ad]" /><select value={classId} onChange={(event) => setClassId(event.target.value)} className="ml-3 min-w-0 flex-1 appearance-none bg-transparent pr-6 text-lg font-extrabold text-[#17488f] outline-none"><option value="">{t('teacher.noClassSelected')} · {t('teacher.optional')}</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><TeacherIcon name="down" className="pointer-events-none absolute right-4 size-5 text-[#1555ad]" /></label><div className="flex-1 space-y-5 py-5"><ChatBubble role="assistant" content={`${t('teacher.welcome')} ${name}.`} />{suggested && <ChatBubble role="assistant" content={t('teacher.howCanHelp')} />}{messages.map((message, index) => <ChatBubble key={`${message.role}-${index}`} role={message.role} content={message.content} selectedClass={selectedClass} />)}{busy && <div className="flex items-center gap-3"><img src="/brand/reanmate-owl-logo-thinking.webp" alt="" aria-hidden="true" className="size-11" /><span className="rounded-2xl bg-white px-4 py-3 font-semibold text-[#7197d0] shadow-sm">{t('assistant.thinking')}</span></div>}</div><p className="mb-3 text-center text-sm font-semibold text-[#7197d0]"><TeacherIcon name="info" className="mr-1 inline size-4" />{t('teacher.aiDisclaimer')}</p><div className="flex items-center gap-2 rounded-full bg-white p-2 pl-4 shadow-lg ring-1 ring-[#cde2f8]"><TeacherIcon name="clip" className="size-6 text-[#1555ad]" /><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask(); } }} placeholder={t('teacher.followUp')} className="min-w-0 flex-1 bg-transparent py-2 text-base font-semibold text-[#17488f] outline-none placeholder:text-[#8bacdd]" /><button type="button" onClick={ask} disabled={busy || !question.trim()} aria-label={t('assistant.send')} className="grid size-11 place-items-center rounded-full bg-[#204e9f] text-white disabled:opacity-50"><TeacherIcon name="send" className="size-6" /></button></div></div></main>;
};

const ChatBubble = ({ role, content, selectedClass }) => role === 'user' ? <div className="flex justify-end"><div className="max-w-[82%] rounded-[1.5rem] rounded-br-sm bg-gradient-to-br from-[#284f9f] to-[#1a4291] px-5 py-4 text-lg font-semibold leading-relaxed text-white shadow-sm">{content}</div></div> : <div className="flex items-start gap-3"><img src="/brand/reanmate-owl-logo-waving.png" alt="" aria-hidden="true" className="size-12 shrink-0 rounded-full bg-[#d9ebff] object-contain" /><div className="max-w-[85%] rounded-[1.5rem] rounded-tl-sm bg-white px-5 py-4 text-lg font-semibold leading-relaxed text-[#17488f] shadow-[0_5px_16px_rgb(18_75_148/0.09)]">{content}{selectedClass && <div className="mt-4 rounded-2xl bg-[#eef7ff] p-3 text-base"><strong className="block">{selectedClass.title}</strong><span className="mt-1 block text-[#5f88c2]">{selectedClass.studentCount} students</span></div>}</div></div>;

const GenerateDraft = ({ t, classes, initialClassId, isQuiz, onBack, onDone }) => {
  const [classId, setClassId] = useState(initialClassId || classes[0]?.id || '');
  const [sourceIds, setSourceIds] = useState([]);
  const [sourceError, setSourceError] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [materialSearch, setMaterialSearch] = useState('');
  const fileInput = useRef(null);
  const { data: materialsData, refresh: refreshMaterials } = useTeacherMaterials(classId);
  const [difficulty, setDifficulty] = useState('medium');
  const [count, setCount] = useState(10);
  const [types, setTypes] = useState(['multipleChoice', 'trueFalse']);
  const [answerKey, setAnswerKey] = useState(true);
  const [rubric, setRubric] = useState(true);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { language } = useLanguage();
  const selected = classes.find((item) => item.id === classId);
  const materials = materialsData?.materials ?? [];
  const filteredMaterials = useMemo(() => {
    const query = materialSearch.trim().toLowerCase();
    return query ? materials.filter((item) => item.title?.toLowerCase().includes(query)) : materials;
  }, [materials, materialSearch]);
  const selectedMaterials = materials.filter((item) => sourceIds.includes(item.id));
  useEffect(() => {
    if (!classId && classes[0]?.id) setClassId(classes[0].id);
  }, [classes, classId]);
  useEffect(() => {
    setSourceIds([]);
    setMaterialSearch('');
    setPickerOpen(false);
  }, [classId]);
  const generate = async () => { if (!classId || generating) return; setGenerating(true); setSourceError(null); try { const draft = isQuiz ? await generateTeacherQuiz({ classId, sourceMaterialIds: sourceIds, count, language, difficulty, questionTypes: types, includeAnswerKey: answerKey }) : null; onDone(draft); } catch (cause) { setSourceError(cause?.response?.data?.error?.message ?? t('errors.generic')); } finally { setGenerating(false); } };
  const addFiles = async (event) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    if (!files.length || !classId) return;
    setBusy(true); setSourceError(null);
    try {
      const added = [];
      for (const file of files) added.push(await uploadTeacherMaterial(classId, { file, title: file.name }));
      setSourceIds((ids) => [...ids, ...added.map((item) => item.id)]);
      await refreshMaterials();
    } catch (cause) { setSourceError(cause?.response?.data?.error?.message ?? t('errors.generic')); } finally { setBusy(false); }
  };
  const toggleType = (type) => setTypes((items) => items.includes(type) ? items.filter((item) => item !== type) : [...items, type]);
  return <main className="teacher-page min-h-full pb-5"><TeacherHeader backTo="/teacher/assistant" title={isQuiz ? t('teacher.generateQuiz') : t('teacher.generateWithAi')} owl /><div className="space-y-5 px-5 pt-5"><h2 className="text-3xl font-extrabold leading-tight text-[#16458e]">{isQuiz ? t('teacher.generateQuizTitle') : t('teacher.generateAssignmentTitle')}</h2><TeacherCard><h3 className="text-xl font-extrabold text-[#16458e]">{t('teacher.sourceMaterials')}</h3><p className="mt-1 font-semibold text-[#80a4dc]">{t('teacher.sourceMaterialsHint')}</p><input ref={fileInput} type="file" multiple accept=".pdf,.docx,.pptx,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={addFiles} /><div className="mt-4 rounded-xl bg-[#f4f8ff] p-3"><div className="flex items-center gap-3"><TeacherIconTile name="document" className="size-10 rounded-xl" iconClassName="size-5" /><span className="min-w-0 flex-1"><strong className="block text-[#17488f]">{sourceIds.length ? t('teacher.selectedMaterialsCount', { count: sourceIds.length }) : t('teacher.noSourceMaterialsSelected')}</strong><span className="block truncate text-sm font-semibold text-[#80a4dc]">{selectedMaterials.slice(0, 2).map((item) => item.title).join(', ') || t('teacher.chooseFromClassHint')}</span></span></div></div><button type="button" disabled={!classId || busy} onClick={() => setPickerOpen(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#b9dafc] py-3 font-extrabold text-[#1266c8] disabled:cursor-not-allowed disabled:opacity-50"><TeacherIcon name="search" className="size-5" />{t('teacher.chooseFromClass')}</button><button type="button" disabled={!classId || busy} onClick={() => fileInput.current?.click()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#b9dafc] py-3 font-extrabold text-[#1266c8] disabled:cursor-not-allowed disabled:opacity-50"><TeacherIcon name="clip" className="size-5" />{t('teacher.addAnotherFile')}</button>{sourceError && <p role="alert" className="mt-3 rounded-xl bg-danger-50 p-3 text-sm font-semibold text-danger-600">{sourceError}</p>}<label className="mt-5 block text-lg font-extrabold text-[#16458e]">{t('teacher.selectClassLabel')}<select value={classId} onChange={(event) => setClassId(event.target.value)} className="teacher-input mt-2"><option value="">{t('teacher.selectClass')}</option>{classes.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>{!isQuiz && <label className="mt-4 block text-lg font-extrabold text-[#16458e]">{t('teacher.learningGoal')}<input className="teacher-input mt-2" placeholder={t('teacher.learningGoal')} /></label>}<h3 className="mt-5 text-lg font-extrabold text-[#16458e]">{t('teacher.difficulty')}</h3><div className="mt-2 grid grid-cols-3 rounded-full bg-[#edf6ff] p-1">{['easy', 'medium', 'hard'].map((item) => <button type="button" key={item} onClick={() => setDifficulty(item)} className={`rounded-full px-2 py-3 font-extrabold ${difficulty === item ? 'bg-[#254f9f] text-white' : 'text-[#1a59ad]'}`}>{t(`teacher.${item}`)}</button>)}</div><h3 className="mt-5 text-lg font-extrabold text-[#16458e]">{t('teacher.questionTypes')}</h3><div className="mt-2 flex flex-wrap gap-2">{['multipleChoice', 'trueFalse', 'shortAnswer'].map((item) => <button type="button" key={item} onClick={() => toggleType(item)} className={`rounded-full px-3 py-2 text-sm font-extrabold ${types.includes(item) ? 'bg-[#e2f0ff] text-[#1555ad]' : 'bg-[#f5f9fe] text-[#83a5d7] ring-1 ring-[#dceafb]'}`}>{types.includes(item) ? '✓ ' : ''}{t(`teacher.${item}`)}</button>)}</div><div className="mt-5 flex items-center gap-3 rounded-xl border border-[#dceafb] p-3"><button type="button" onClick={() => setCount((value) => Math.max(1, value - 1))} className="grid size-8 place-items-center rounded-full bg-[#eaf4ff] text-xl text-[#1555ad]">−</button><strong className="flex-1 text-center text-lg text-[#17488f]">{count}</strong><button type="button" onClick={() => setCount((value) => Math.min(30, value + 1))} className="grid size-8 place-items-center rounded-full bg-[#eaf4ff] text-xl text-[#1555ad]">+</button></div>{isQuiz ? <TeacherToggle id="answer-key" checked={answerKey} onChange={() => setAnswerKey((value) => !value)} label={t('teacher.includeAnswerKey')} /> : <><TeacherToggle id="answer-key" checked={answerKey} onChange={() => setAnswerKey((value) => !value)} label={t('teacher.includeAnswerKey')} /><TeacherToggle id="rubric" checked={rubric} onChange={() => setRubric((value) => !value)} label={t('teacher.includeRubric')} /></>}  </TeacherCard>{pickerOpen && <MaterialPicker t={t} materials={filteredMaterials} selectedIds={sourceIds} search={materialSearch} setSearch={setMaterialSearch} toggle={(id) => setSourceIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])} close={() => setPickerOpen(false)} />}  {generating ? <GenerationProgress t={t} isQuiz={isQuiz} /> : <TeacherButton onClick={generate} disabled={busy || !selected} className="w-full"><TeacherIcon name="sparkle" className="size-6" />{busy ? t('assistant.thinking') : isQuiz ? t('teacher.generateQuiz') : t('teacher.createAssignment')}</TeacherButton>}<p className="text-center text-sm font-semibold text-[#7b9ed0]">{t('teacher.aiDisclaimer')}</p><button type="button" onClick={onBack} className="w-full py-2 text-lg font-extrabold text-[#155dcc]">{t('common.cancel')}</button></div></main>;
};

const GenerationProgress = ({ t, isQuiz }) => (
  <TeacherCard className="overflow-hidden border-2 border-[#cfe3ff] bg-gradient-to-br from-[#f8fbff] to-[#eef6ff] text-center" >
    <div className="mx-auto grid size-20 place-items-center rounded-full bg-[#dcecff]">
      <span className="grid size-14 place-items-center rounded-full border-4 border-[#dcecff] border-t-[#2d62bd] border-r-[#5c89df] animate-spin" aria-hidden="true">
        <TeacherIcon name="sparkle" className="size-7 text-[#2d62bd]" />
      </span>
    </div>
    <h3 className="mt-4 text-xl font-extrabold text-[#16458e]">{t(isQuiz ? 'teacher.generatingQuiz' : 'teacher.generatingAssignment')}</h3>
    <p className="mt-1 font-semibold text-[#779bd2]">{t('teacher.generatingHint')}</p>
    <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#dcecff]" aria-hidden="true"><span className="block h-full w-1/2 animate-pulse rounded-full bg-[#4776d1]" /></div>
    <p className="mt-3 text-sm font-bold text-[#80a4dc]" role="status" aria-live="polite">{t('teacher.generatingStatus')}</p>
  </TeacherCard>
);

const SourceFile = ({ title, type, selected = false, onToggle }) => <button type="button" onClick={onToggle} className={`mt-3 flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selected ? 'border-[#4d78d8] bg-[#f0f6ff]' : 'border-[#dceafb] bg-white'}`}><TeacherIconTile name="document" tone={type === 'PDF' ? 'red' : 'blue'} className="size-10 rounded-xl" iconClassName="size-5" /><span className="min-w-0 flex-1"><strong className="block truncate text-[#17488f]">{title}</strong><span className="text-sm font-semibold text-[#80a4dc]">{type}</span></span><span className={`grid size-6 place-items-center rounded-full border-2 ${selected ? 'border-[#2e63c4] bg-[#2e63c4] text-white' : 'border-[#b9d5f5]'}`}>{selected ? '✓' : ''}</span></button>;

const MaterialPicker = ({ t, materials, selectedIds, search, setSearch, toggle, close }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#12366f]/35 p-3 sm:items-center">
    <section role="dialog" aria-modal="true" className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-[1.5rem] bg-[#f8fbff] shadow-2xl">
      <div className="flex items-center gap-3 border-b border-[#dceafb] bg-white px-5 py-4"><div className="min-w-0 flex-1"><h2 className="text-xl font-extrabold text-[#16458e]">{t('teacher.chooseFromClass')}</h2><p className="text-sm font-semibold text-[#80a4dc]">{t('teacher.selectedMaterialsCount', { count: selectedIds.length })}</p></div><button type="button" onClick={close} aria-label={t('common.close')} className="grid size-10 place-items-center rounded-full bg-[#edf5ff] text-[#1555ad]"><TeacherIcon name="close" className="size-5" /></button></div>
      <div className="space-y-3 overflow-y-auto p-4"><label className="flex items-center gap-2 rounded-full bg-white px-4 py-3 ring-1 ring-[#cfe2f8]"><TeacherIcon name="search" className="size-5 text-[#1555ad]" /><span className="sr-only">{t('common.search')}</span><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('teacher.searchMaterials')} className="min-w-0 flex-1 bg-transparent font-semibold text-[#17488f] outline-none placeholder:text-[#88a9dd]" /></label><div className="space-y-2">{materials.map((item) => <SourceFile key={item.id} title={item.title} type={item.mimeType?.includes('pdf') ? 'PDF' : 'FILE'} selected={selectedIds.includes(item.id)} onToggle={() => toggle(item.id)} />)}</div>{!materials.length && <p className="py-8 text-center font-semibold text-[#80a4dc]">{t('teacher.noMaterialsInClass')}</p>}</div>
      <div className="border-t border-[#dceafb] bg-white p-4"><TeacherButton onClick={close} className="w-full">{t('common.done')}</TeacherButton></div>
    </section>
  </div>
);

const DraftEditor = ({ t, isQuiz, draft, onBack }) => {
  const navigate = useNavigate();
  const [title, setTitle] = useState(draft?.title ?? (isQuiz ? t('teacher.generateQuiz') : t('teacher.sampleAssignment')));
  const [dueAt, setDueAt] = useState(toDateTimeLocal(draft?.dueAt));
  const [items, setItems] = useState(() => (draft?.questions ?? (isQuiz ? [] : ['problemSolving', 'multipleChoice', 'shortAnswer'])).map(normalizeDraftQuestion));
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedResult, setSavedResult] = useState(null);
  const [showPublishNotice, setShowPublishNotice] = useState(false);
  useEffect(() => {
    if (!showPublishNotice) return undefined;
    const timer = window.setTimeout(() => setShowPublishNotice(false), 8000);
    return () => window.clearTimeout(timer);
  }, [showPublishNotice]);
  const typeLabel = (item) => {
    const type = item.kind;
    return type === 'multiple_choice' ? 'multipleChoice' : type === 'true_false' ? 'trueFalse' : type === 'short_answer' ? 'shortAnswer' : type;
  };
  const updateQuestion = (index, patch) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const save = async () => {
    if (!isQuiz || saving) return;
    setSaving(true); setError(null);
    try {
      const result = await createTeacherQuiz({
        classId: draft?.classId,
        title: title.trim(),
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        questions: items,
        count: items.length,
        publish: true,
      });
      setSavedResult(result);
      setShowPublishNotice(true);
      setSaved(true);
    } catch (cause) {
      setError(cause?.response?.data?.error?.message ?? t('errors.generic'));
    } finally { setSaving(false); }
  };
  return <main className="teacher-page min-h-full pb-5"><TeacherHeader backTo="/teacher/assistant" title={isQuiz ? t('teacher.editQuiz') : t('teacher.editAssignment')} action={<StatusPill>{t('teacher.aiDraft')}</StatusPill>} />{savedResult && showPublishNotice && <div className="fixed inset-x-0 top-4 z-50 mx-auto w-[calc(100%-2rem)] max-w-[26rem]" role="status" aria-live="polite"><div className="rounded-2xl border-2 border-[#bdebdc] bg-[#f0fff9] p-4 shadow-2xl"><div className="flex items-start gap-3"><TeacherIcon name="check" className="mt-0.5 size-6 shrink-0 text-[#087c59]" /><div className="min-w-0 flex-1"><strong className="block text-[#087c59]">{t('teacher.quizPublished')}</strong><p className="mt-1 text-sm font-semibold text-[#4d927d]">{t('teacher.quizPublishedHint')}</p></div><button type="button" onClick={() => setShowPublishNotice(false)} aria-label={t('common.close')} className="text-xl font-bold leading-none text-[#4d927d]">×</button></div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => navigate(`/teacher/classes/${draft.classId}?tab=classwork`)} className="rounded-xl bg-[#087c59] px-3 py-3 text-sm font-extrabold text-white">{t('teacher.viewClasswork')}</button><button type="button" onClick={() => navigate(`/teacher/assignments/${savedResult.assignment.id}`)} className="rounded-xl border border-[#8ed9c1] px-3 py-3 text-sm font-extrabold text-[#087c59]">{t('teacher.viewQuiz')}</button></div></div></div>}<div className="space-y-4 px-5 pt-5"><div className="flex items-center gap-3 rounded-xl bg-[#eaf5ff] p-3 text-[#1555ad]"><TeacherIcon name="sparkle" className="size-7" /><strong className="flex-1">{t(isQuiz ? 'teacher.aiCreatedQuiz' : 'teacher.aiCreatedAssignment', { count: items.length })}</strong><button type="button" className="font-extrabold">{t('teacher.regenerate')}</button></div><TeacherCard><label className="block text-sm font-bold text-[#86a6d7]">{t('teacher.title')}<input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full border-b border-[#dceafb] pb-2 text-xl font-extrabold text-[#17488f] outline-none" /></label><label className="mt-4 block text-sm font-bold text-[#86a6d7]">{t('teacher.chooseDate')}<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="teacher-input mt-1" /></label></TeacherCard>{error && <p role="alert" className="rounded-xl bg-danger-50 p-3 text-sm font-semibold text-danger-600">{error}</p>}<div className="flex items-center justify-between"><h2 className="text-2xl font-extrabold text-[#16458e]">{t('teacher.questions')}</h2><span className="font-extrabold text-[#0c71dc]">{items.length} {t('teacher.questions').toLowerCase()}</span></div>{!items.length && <TeacherCard className="text-center font-semibold text-[#80a4dc]">{t('teacher.noGeneratedQuestions')}</TeacherCard>}{items.map((item, index) => { const type = typeLabel(item); return <TeacherCard key={`${type}-${index}`} className="space-y-3"><div className="flex items-center gap-3"><span className="text-[#9db8df]">⠿</span><strong className="flex-1 text-lg text-[#17488f]">{index + 1}. {t(`teacher.${type}`)}</strong><button type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={t('teacher.archiveClass')}><TeacherIcon name="trash" className="size-5 text-[#ed4d5d]" /></button></div><textarea value={item.prompt} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} className="teacher-input min-h-20 w-full" aria-label={`${t('teacher.questions')} ${index + 1}`} />{item.options?.map((option, optionIndex) => <div className="flex items-center gap-2" key={`${index}-${optionIndex}`}><input type="radio" name={`correct-${index}`} checked={item.correctAnswer === optionIndex} onChange={() => updateQuestion(index, { correctAnswer: optionIndex })} /><input value={option} onChange={(event) => updateQuestion(index, { options: item.options.map((value, valueIndex) => valueIndex === optionIndex ? event.target.value : value) })} className="teacher-input flex-1" /></div>)}{!item.options?.length && <input value={item.correctAnswer ?? ''} onChange={(event) => updateQuestion(index, { correctAnswer: event.target.value })} className="teacher-input w-full" placeholder={t('teacher.correctAnswer')} />}</TeacherCard>; })}<div className="grid grid-cols-2 gap-3"><TeacherButton tone="gold" onClick={save} disabled={saving || !isQuiz || !title.trim() || Boolean(savedResult)}>{saving ? t('assistant.thinking') : isQuiz ? t('teacher.saveQuiz') : t('teacher.saveAssignment')}</TeacherButton><TeacherButton tone="outline" onClick={onBack}>{saved ? '✓ ' : ''}{t('teacher.keepEditing')}</TeacherButton></div></div></main>;
};

const toDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const normalizeDraftQuestion = (item) => typeof item === 'string'
  ? { kind: 'short_answer', prompt: item, options: [], correctAnswer: '' }
  : { ...item, options: item.options ?? [] };

const PerformanceReview = ({ t, classes, onBack }) => {
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const { data } = useTeacherClassStudents(classId);
  const students = data?.students ?? [];
  const average = students.length ? Math.round(students.reduce((sum, item) => sum + Number(item.averageScore || 0), 0) / students.length) : 0;
  const needsSupport = students.filter((item) => Number(item.averageScore || 0) < 70).length;
  const completed = students.length ? Math.round(students.reduce((sum, item) => sum + (item.assignmentCount ? Number(item.submittedAssignments || 0) / Number(item.assignmentCount) : 0), 0) / students.length * 100) : 0;
  return <main className="teacher-page min-h-full pb-5"><TeacherHeader backTo="/teacher/assistant" title={t('teacher.reviewPerformance')} /><div className="space-y-4 px-5 pt-5"><select value={classId} onChange={(event) => setClassId(event.target.value)} className="teacher-input w-full">{classes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><div className="grid grid-cols-3 gap-3"><Metric icon="chart" label={t('teacher.classAverage')} value={`${average}%`} /><Metric icon="info" label={t('teacher.needsSupport')} value={needsSupport} /><Metric icon="check" label={t('teacher.completed')} value={`${completed}%`} /></div><TeacherCard><h2 className="flex items-center gap-3 text-2xl font-extrabold text-[#16458e]"><TeacherIcon name="people" className="size-7" />{t('teacher.needsSupport')}</h2>{students.filter((student) => Number(student.averageScore || 0) < 70).map((student) => <div key={student.id} className="mt-4 flex items-center gap-3"><Avatar name={student.name} className="size-11" /><span className="min-w-0 flex-1"><strong className="block truncate text-[#17488f]">{student.name}</strong><span className="text-sm font-semibold text-[#80a4dc]">{Math.round(Number(student.averageScore || 0))}% {t('teacher.averageScore')}</span></span><StatusPill tone="gold">{t('teacher.needsSupport')}</StatusPill></div>)}{!needsSupport && <p className="py-6 text-center font-semibold text-[#80a4dc]">{t('teacher.noStudents')}</p>}</TeacherCard></div></main>;
};

const Metric = ({ icon, label, value }) => <TeacherCard className="p-3"><TeacherIconTile name={icon} className="size-10 rounded-xl" iconClassName="size-5" /><strong className="mt-3 block text-3xl text-[#17488f]">{value}</strong><span className="mt-1 block text-sm font-bold text-[#779bd2]">{label}</span></TeacherCard>;
