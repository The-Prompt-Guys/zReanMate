import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useT } from '../../i18n/index.js';
import { useTeacherAssignments } from './useTeacher.js';
import { Chevron, StatusPill, TeacherCard, TeacherHeader, TeacherIcon, TeacherIconTile } from './TeacherUI.jsx';

export const TeacherCalendarPage = () => {
  const t = useT();
  const { data } = useTeacherAssignments();
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(null);
  const assignments = data?.assignments ?? [];
  const { cells, label } = useMemo(() => calendarCells(cursor), [cursor]);
  const events = assignments.filter((item) => item.dueAt).map((item) => ({ ...item, day: dateKey(new Date(item.dueAt)) }));
  const selectedEvents = selected ? events.filter((item) => item.day === selected) : events.slice(0, 4);
  const weekDays = ['daySun', 'dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat'];
  return <main className="teacher-page min-h-full pb-5"><TeacherHeader backTo="/teacher" title={t('teacher.calendarTitle')} /><div className="space-y-4 px-5 pt-5"><TeacherCard><div className="flex items-center justify-between"><button type="button" onClick={() => setCursor((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))} aria-label={t('common.back')} className="grid size-9 place-items-center rounded-full bg-[#eaf5ff] text-[#1555ad]"><TeacherIcon name="back" className="size-5" /></button><h2 className="text-xl font-extrabold text-[#16458e]">{label}</h2><button type="button" onClick={() => setCursor((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))} aria-label={t('teacher.upcoming')} className="grid size-9 place-items-center rounded-full bg-[#eaf5ff] text-[#1555ad]"><Chevron /></button></div><div className="mt-5 grid grid-cols-7 gap-y-2 text-center text-xs font-extrabold text-[#82a5d8]">{weekDays.map((day) => <span key={day}>{t(`teacher.${day}`)}</span>)}{cells.map((cell, index) => { const hasEvent = events.some((item) => item.day === cell.key); const active = selected === cell.key; return <button type="button" key={`${cell.key}-${index}`} disabled={!cell.current} onClick={() => setSelected(cell.key)} className={`relative mx-auto grid size-9 place-items-center rounded-full text-sm font-bold transition ${active ? 'bg-[#174b9c] text-white' : cell.current ? 'text-[#17488f] hover:bg-[#eaf5ff]' : 'text-[#c6d6eb]'}`}>{cell.date.getDate()}{hasEvent && <span className={`absolute bottom-0.5 size-1.5 rounded-full ${active ? 'bg-gold-300' : 'bg-[#0878f9]'}`} />}</button>; })}</div></TeacherCard><TeacherCard><div className="flex items-center gap-3"><TeacherIconTile name="calendar" /><h2 className="flex-1 text-xl font-extrabold text-[#16458e]">{selected ? new Date(`${selected}T00:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) : t('teacher.upcoming')}</h2></div><div className="mt-4 space-y-3">{selectedEvents.map((item) => <Link to={`/teacher/assignments/${item.id}`} key={item.id} className="flex items-center gap-3 rounded-xl bg-[#f1f8ff] p-3"><TeacherIconTile name={item.type === 'quiz' ? 'check' : 'assignment'} className="size-10 rounded-xl" iconClassName="size-5" /><span className="min-w-0 flex-1"><strong className="block truncate text-base text-[#17488f]">{item.title}</strong><span className="block text-sm font-semibold text-[#80a4dc]">{item.className}</span></span><StatusPill>{item.dueAt ? new Date(item.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : t('teacher.noDueDate')}</StatusPill><Chevron className="text-[#1555ad]" /></Link>)}{!selectedEvents.length && <p className="py-5 text-center font-semibold text-[#80a4dc]">{t('teacher.noDueDate')}</p>}</div></TeacherCard></div></main>;
};

const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const calendarCells = (cursor) => {
  const year = cursor.getFullYear(); const month = cursor.getMonth();
  const first = new Date(year, month, 1); const start = new Date(year, month, 1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return { date, key: dateKey(date), current: date.getMonth() === month }; });
  return { cells, label: first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
};
