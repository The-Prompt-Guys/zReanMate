import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRightIcon, Button } from '../../components/ui.jsx';
import { useLanguage, useT } from '../../i18n/index.js';
import { useKits } from '../../kits/KitsContext.jsx';
import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';

export const PracticeSetupPage = () => {
  const t = useT(); const { language } = useLanguage(); const navigate = useNavigate();
  const [params] = useSearchParams(); const { kits } = useKits(); const kit = kits[0];
  const [count, setCount] = useState(10); const [format, setFormat] = useState('multiple_choice'); const [timer, setTimer] = useState(600);
  const start = () => { window.sessionStorage.setItem('reanmate:practice-setup', JSON.stringify({ studyKitId: kit.id, mode: params.get('mock') === '1' ? 'mock_exam' : 'practice', questionCount: count, answerFormat: format, timerSeconds: timer })); navigate('/practice/lessons'); };
  return <main><NavyHeader><div className="flex items-start gap-3"><Link to="/practice" aria-label={t('common.back')} className="mt-1 shrink-0"><svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></Link><div><h1 className="text-2xl font-bold">{params.get('mock') === '1' ? t('practice.mockExam') : t('practice.title')}</h1><p className="text-white/75">{language === 'km' ? (kit?.titleKm || kit?.title) : kit?.title}</p></div></div></NavyHeader><div className="px-5 pt-6"><div className="flex items-start justify-between"><div><h2 className="text-2xl font-bold text-navy-900">{t('practice.setupTitle')}</h2><p className="text-navy-600">{t('practice.setupSubtitle')}</p></div><Owl variant="waving" className="size-20" /></div><Control label={t('practice.questionCount')}>{[5,10,20].map((value)=><Choice key={value} selected={count===value} onClick={()=>setCount(value)} label={String(value)} />)}</Control><Control label={t('practice.answerFormat')}><Choice selected={format==='multiple_choice'} onClick={()=>setFormat('multiple_choice')} label={t('practice.multipleChoice')} /><Choice selected={format==='written'} onClick={()=>setFormat('written')} label={t('practice.writeAnswer')} /></Control><Control label={t('practice.timer')}>{[0,300,600,1200].map((value)=><Choice key={value} selected={timer===value} onClick={()=>setTimer(value)} label={value===0?t('practice.noTimer'):t('practice.minutes',{count:value/60})} />)}</Control><div className="mt-5 pb-4"><Button disabled={!kit} onClick={start}>{t('practice.start')}<ArrowRightIcon /></Button></div></div></main>;
};
const Control=({label,children})=><section className="mt-5 rounded-card bg-tint-100/70 p-4"><h3 className="text-lg font-bold text-navy-900">{label}</h3><div className="mt-3 flex flex-wrap gap-2">{children}</div></section>;
const Choice=({selected,onClick,label})=><button type="button" onClick={onClick} aria-pressed={selected} className={`flex-1 rounded-xl px-4 py-3.5 font-semibold ${selected?'bg-navy-800 text-white':'bg-white text-navy-900'}`}>{label}</button>;
