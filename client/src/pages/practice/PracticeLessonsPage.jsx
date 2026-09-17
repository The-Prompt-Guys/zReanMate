import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SearchField } from '../../components/listControls.jsx';
import { Button } from '../../components/ui.jsx';
import { useT } from '../../i18n/index.js';
import { api, toFormError } from '../../lib/api.js';
import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';

/**
 * The lessons a session will draw on.
 *
 * `?sourceId=` carries through from the setup screen, and it narrows the list
 * to the topics that one file produced questions for — offering a lesson from
 * elsewhere in the kit would let the exam wander off the chosen material.
 */
export const PracticeLessonsPage=()=>{const t=useT();const navigate=useNavigate();const [params]=useSearchParams();const sourceId=params.get('sourceId');const kitId=params.get('kitId');const [query,setQuery]=useState('');const [topics,setTopics]=useState([]);const [selected,setSelected]=useState([]);const [error,setError]=useState(null);const setup=JSON.parse(window.sessionStorage.getItem('reanmate:practice-setup')||'null');useEffect(()=>{api.get('/practice/topics',{params:{q:query||undefined,sourceId:sourceId||undefined}}).then(({data})=>setTopics(data.topics)).catch((err)=>setError(toFormError(err)));},[query,sourceId]);const create=async()=>{try{const {data}=await api.post('/practice/sessions',{...setup,topicIds:selected});window.localStorage.setItem('reanmate:practice-session',data.session.id);navigate(`/practice/session?sessionId=${data.session.id}`);}catch(err){setError(toFormError(err));}};return <main><NavyHeader className="flex items-start justify-between"><div className="flex gap-3"><Link to={sourceId?`/practice/setup?kitId=${encodeURIComponent(kitId??'')}&sourceId=${encodeURIComponent(sourceId)}`:"/practice/setup"} aria-label={t('common.back')}>←</Link><div><h1 className="text-2xl font-bold">{t('practice.chooseLesson')}</h1><p className="text-white/75">{t('practice.chooseLessonHint')}</p></div></div><Owl variant="default" className="size-16" /></NavyHeader><div className="space-y-4 px-5 pt-4"><SearchField value={query} onChange={setQuery} placeholder={t('practice.searchLessons')} label={t('practice.searchLessons')} />{error&&<p className="text-danger-600">{error.code==='quota_exceeded'?t('practice.weeklyLimit'):error.code==='feature_unavailable'?t('practice.mockPlus'):t('practice.loadFailed')}</p>}<ul className="space-y-3">{topics.map((topic)=>{const active=selected.includes(topic.id);return <li key={topic.id}><label className="flex cursor-pointer items-center gap-3 rounded-card bg-white p-4 ring-1 ring-tint-200"><input type="checkbox" checked={active} onChange={()=>setSelected((value)=>active?value.filter((id)=>id!==topic.id):[...value,topic.id])} /><span className="flex-1"><span className="font-bold text-navy-900">{topic.title}</span><span className="block text-sm text-navy-600">{topic.mastery===null?t('practice.newTopic'):t('practice.masteryPercent',{percent:topic.mastery})}</span></span>{topic.recommended&&<span className="rounded-full bg-gold-400/35 px-2 py-1 text-xs font-bold">{t('practice.recommended')}</span>}</label></li>})}</ul><div className="pb-4"><Button disabled={!setup} onClick={create}>{t('common.continue')}</Button></div></div></main>;};
