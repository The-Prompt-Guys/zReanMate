import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { useT } from '../../i18n/index.js';

/**
 * Shared visual primitives for the teacher experience.  The student area uses
 * a quieter navy header; teacher screens have the same palette but stronger
 * hierarchy, large friendly cards and a consistent classroom illustration.
 */
export const TeacherHeader = ({
  title,
  subtitle,
  backTo,
  children,
  compact = false,
  owl = false,
  action,
  className = '',
}) => {
  const t = useT();
  const { user } = useAuth();
  const name = user?.full_name ?? user?.fullName ?? t('teacher.defaultName');

  return (
    <header className={`teacher-hero relative isolate overflow-visible rounded-b-[2rem] px-5 text-white ${compact ? 'pb-5 pt-5' : 'pb-7 pt-6'} ${className}`}>
      <div className="relative z-10 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {backTo && (
            <Link to={backTo} aria-label={t('common.back')} className="grid size-9 shrink-0 place-items-center rounded-full transition hover:bg-white/10">
              <TeacherIcon name="back" className="size-6" />
            </Link>
          )}
          <Link to="/teacher" className="flex min-w-0 items-center gap-2.5" aria-label={t('common.appName')}>
            <img src="/brand/reanmate-owl-logo-waving.png" alt="" aria-hidden="true" className="size-10 shrink-0 object-contain" />
            <span className="truncate text-2xl font-extrabold tracking-tight">ReanMate</span>
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <button type="button" aria-label={t('teacher.notifications')} className="relative grid size-9 place-items-center rounded-full text-white/95 transition hover:bg-white/10">
            <TeacherIcon name="bell" className="size-5" />
            <span className="absolute right-1 top-1 size-2 rounded-full bg-gold-300" />
          </button>
          <Link to="/teacher/profile" aria-label={t('teacher.profileNav')} className="grid size-10 place-items-center overflow-hidden rounded-full bg-white/20 ring-2 ring-white/25">
            <Avatar name={name} user={user} className="size-10 text-sm" />
          </Link>
        </div>
      </div>

      {(title || subtitle || owl || children) && (
        <div className={`relative z-10 ${compact ? 'mt-4' : 'mt-6'}`}>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              {title && <h1 className="teacher-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-[2.6rem]">{title}</h1>}
              {subtitle && <p className="mt-2 text-lg font-semibold leading-snug text-white/80">{subtitle}</p>}
            </div>
            {owl && <Owl variant="waving" className="-mb-8 -mr-2 size-28 shrink-0 object-contain sm:size-32" />}
          </div>
          {children}
        </div>
      )}
    </header>
  );
};

export const TeacherCard = ({ children, className = '' }) => (
  <section className={`rounded-[1.45rem] bg-white p-4 shadow-[0_7px_22px_rgb(19_76_151/0.08)] ring-1 ring-[#dceafb] ${className}`}>
    {children}
  </section>
);

export const TeacherIconTile = ({ name, tone = 'blue', className = '', iconClassName = '' }) => {
  const tones = {
    blue: 'bg-[#e8f3ff] text-[#0661cd]',
    gold: 'bg-[#fff1d8] text-[#f49b13]',
    green: 'bg-[#e4f9ee] text-[#00a968]',
    red: 'bg-[#ffedf0] text-[#e7435d]',
    lilac: 'bg-[#f0ecff] text-[#7b61df]',
  };
  return <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${tones[tone] ?? tones.blue} ${className}`}><TeacherIcon name={name} className={`size-7 ${iconClassName}`} /></span>;
};

export const TeacherButton = ({ children, tone = 'navy', className = '', ...props }) => {
  const tones = {
    navy: 'bg-gradient-to-r from-[#143f94] to-[#2455ac] text-white shadow-[#1b4ea4]/20 hover:brightness-110',
    gold: 'bg-gradient-to-r from-[#ffad33] to-[#ffbd55] text-white shadow-[#f8a12c]/20 hover:brightness-105',
    soft: 'bg-[#edf6ff] text-[#0760c9] hover:bg-[#dfedfc]',
    outline: 'bg-white text-[#075dcc] ring-1 ring-[#bcdcff] hover:bg-[#f5faff]',
    danger: 'bg-[#fff0f2] text-[#d6334a] hover:bg-[#ffe5e9]',
  };
  return <button type="button" className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-base font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone] ?? tones.navy} ${className}`} {...props}>{children}</button>;
};

export const TeacherToggle = ({ checked, onChange, label, id }) => (
  <label htmlFor={id} className="flex min-h-12 items-center gap-3 py-2">
    <span className="min-w-0 flex-1 text-base font-semibold text-[#12458f]">{label}</span>
    <button id={id} type="button" role="switch" aria-checked={checked} onClick={onChange} className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition ${checked ? 'bg-[#0878f9]' : 'bg-[#cbdcf2]'}`}>
      <span className={`block size-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  </label>
);

export const Progress = ({ value, className = '', tone = 'blue' }) => {
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  const tones = { blue: 'bg-[#0878f9]', navy: 'bg-[#214d9e]', gold: 'bg-[#ffb241]', red: 'bg-[#ef4558]', green: 'bg-[#00b879]' };
  return <span className={`block h-2 overflow-hidden rounded-full bg-[#e4f0fc] ${className}`}><span className={`block h-full rounded-full ${tones[tone] ?? tones.blue}`} style={{ width: `${width}%` }} /></span>;
};

export const Avatar = ({ name = '', user, className = '' }) => {
  const src = user?.avatar_url ?? user?.avatarUrl;
  if (src) return <img src={src} alt="" aria-hidden="true" className={`rounded-full object-cover ${className}`} />;
  return <span aria-hidden="true" className={`grid place-items-center rounded-full bg-gradient-to-b from-[#e5f5ff] to-[#94c9ff] font-extrabold text-[#174e9e] ${className}`}>{name.trim().charAt(0).toUpperCase() || 'T'}</span>;
};

/** A characterful, non-photoreal class thumbnail that works without extra assets. */
export const ClassArt = ({ index = 0, coverUrl, className = '' }) => {
  const backgrounds = ['from-[#2d75d4] to-[#1b4392]', 'from-[#5a99d6] to-[#316ba8]', 'from-[#9b7bda] to-[#6653ae]', 'from-[#dcac47] to-[#bf8131]', 'from-[#48b99d] to-[#207f78]'];
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br ${backgrounds[index % backgrounds.length]} ${className}`}>
      {coverUrl && <img src={coverUrl} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover" />}
      <span className="absolute -right-2 -top-4 text-4xl text-white/15">∑</span>
      {!coverUrl && <img src="/brand/reanmate-owl-logo-waving.png" alt="" aria-hidden="true" className="relative z-10 h-[86%] w-[86%] object-contain drop-shadow-md" />}
    </span>
  );
};

export const SearchField = ({ value, onChange, placeholder, className = '' }) => (
  <label className={`flex items-center gap-3 rounded-full bg-white px-4 py-3.5 shadow-sm ring-1 ring-[#cfe2f8] ${className}`}>
    <TeacherIcon name="search" className="size-5 shrink-0 text-[#1555ad]" />
    <span className="sr-only">{placeholder}</span>
    <input value={value} onChange={onChange} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-base font-semibold text-[#16488f] outline-none placeholder:text-[#88a9dd]" />
  </label>
);

export const StatusPill = ({ children, tone = 'blue', className = '' }) => {
  const tones = { blue: 'bg-[#ebf5ff] text-[#1671d9]', gold: 'bg-[#fff2d9] text-[#f08d00]', green: 'bg-[#e5faed] text-[#079762]', grey: 'bg-[#edf3fa] text-[#7693bd]', red: 'bg-[#fff0f2] text-[#d7354d]' };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${tones[tone] ?? tones.blue} ${className}`}>{children}</span>;
};

export const Chevron = ({ className = '' }) => <TeacherIcon name="chevron" className={`size-5 ${className}`} />;

/** Tiny consistent icon set. Keeping it local avoids a heavyweight icon package. */
export const TeacherIcon = ({ name, className = 'size-6' }) => {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    back: <><path d="m11 5-7 7 7 7" /><path d="M4.5 12H21" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    down: <path d="m6 9 6 6 6-6" />,
    search: <><circle cx="10.8" cy="10.8" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    bell: <><path d="M18 15v-4.8a6 6 0 0 0-12 0V15l-1.5 3h15z" /><path d="M10 21a2.2 2.2 0 0 0 4 0" /></>,
    home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="9" r="2.4" /><path d="M17.5 15.3A4.8 4.8 0 0 1 21 20" /></>,
    cap: <><path d="m3 9 9-5 9 5-9 5z" /><path d="M6 11v5c3 2.5 9 2.5 12 0v-5" /><path d="M21 9v5" /></>,
    book: <><path d="M4 5.5C7.2 5 9.6 5.7 12 7.5 14.4 5.7 16.8 5 20 5.5V18c-3.2-.5-5.6.2-8 2-2.4-1.8-4.8-2.5-8-2Z" /><path d="M12 7.5V20" /></>,
    document: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
    assignment: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 14l1.6 1.6 3.7-3.7" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></>,
    sparkle: <><path d="m12 2 1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z" /></>,
    profile: <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    edit: <><path d="m4 20 4.1-.9L19 8.2a2.1 2.1 0 0 0-3-3L5.1 16.1z" /><path d="m14.5 6.7 2.8 2.8" /></>,
    upload: <><path d="M12 16V3M7 8l5-5 5 5" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 20h16" /></>,
    clip: <path d="m20 11-7.9 7.9a5 5 0 0 1-7.1-7.1L13.2 3.6a3.5 3.5 0 0 1 5 5L10 16.8a2 2 0 0 1-2.8-2.8l7.5-7.5" />,
    chart: <><path d="M4 20V11M10 20V5M16 20v-7M22 20H2" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    more: <><circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.4 2.4-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3.4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L5.6 17l.1-.1A1.7 1.7 0 0 0 6 15a1.7 1.7 0 0 0-1.5-1H4.3v-3.4h.2A1.7 1.7 0 0 0 6 9.6a1.7 1.7 0 0 0-.3-1.9l-.1-.1L8 5.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h3.4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.4 2.4-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.4 1Z" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 14h10l1-14" /></>,
    eye: <><path d="M2 12s3.3-6 10-6 10 6 10 6-3.3 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    send: <path d="m21 3-7.3 18-3.2-7.5L3 10.3Z M10.5 13.5 21 3" />,
    filter: <><path d="M4 7h16M7 12h10M10 17h4" /><circle cx="7" cy="7" r="1.5" fill="currentColor" /><circle cx="16" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="17" r="1.5" fill="currentColor" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  };
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>{paths[name] ?? paths.document}</svg>;
};
