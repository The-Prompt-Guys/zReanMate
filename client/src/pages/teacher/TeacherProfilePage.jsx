import { useState } from 'react';

import { useAuth } from '../../auth/AuthContext.jsx';
import { LanguageSwitcher, useT } from '../../i18n/index.js';
import { Avatar, Chevron, TeacherCard, TeacherHeader, TeacherIcon, TeacherIconTile, TeacherToggle } from './TeacherUI.jsx';

export const TeacherProfilePage = () => {
  const t = useT();
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const name = user?.full_name ?? user?.fullName ?? t('teacher.defaultName');
  const email = user?.email ?? user?.phone ?? '—';
  return <main className="teacher-page min-h-full pb-5"><TeacherHeader backTo="/teacher" compact /><div className="space-y-5 px-5 pt-5"><TeacherCard className="flex items-center gap-4"><Avatar user={user} name={name} className="size-20 text-2xl" /><span className="min-w-0 flex-1"><strong className="block truncate text-2xl text-[#16458e]">{name}</strong><span className="mt-1 block text-lg font-semibold text-[#80a4dc]">{t('teacher.profileRole')}</span><span className="mt-2 flex items-center gap-2 truncate text-sm font-semibold text-[#2257a4]"><TeacherIcon name="document" className="size-4" />{email}</span></span><button type="button" className="shrink-0 rounded-full border border-[#1971df] px-4 py-2 text-sm font-extrabold text-[#1263c7]"><TeacherIcon name="edit" className="mr-1 inline size-4" />{t('teacher.editProfile')}</button></TeacherCard><SettingsGroup title={t('teacher.preferences')} icon="settings"><TeacherToggle id="profile-notifications" checked={notifications} onChange={() => setNotifications((value) => !value)} label={t('teacher.notifications')} /><SettingsRow icon="chart" label={t('teacher.language')} trailing={<LanguageSwitcher className="rounded-full bg-[#e9f4ff] px-3 py-1.5 text-sm font-extrabold text-[#1555ad]" />} /><SettingsRow icon="sparkle" label={t('teacher.appearance')} value={t('teacher.light')} /></SettingsGroup><SettingsGroup title={t('teacher.account')} icon="profile"><SettingsRow icon="info" label={t('teacher.helpSupport')} /><SettingsRow icon="settings" label={t('teacher.privacySecurity')} /><button type="button" onClick={logout} className="flex w-full items-center gap-3 py-4 text-left"><TeacherIconTile name="back" tone="red" /><strong className="flex-1 text-lg text-[#db3850]">{t('teacher.signOut')}</strong><Chevron className="text-[#db3850]" /></button></SettingsGroup></div></main>;
};

const SettingsGroup = ({ title, icon, children }) => <TeacherCard><h2 className="flex items-center gap-3 text-2xl font-extrabold text-[#16458e]"><TeacherIconTile name={icon} className="size-11 rounded-xl" iconClassName="size-6" />{title}</h2><div className="mt-3 divide-y divide-[#e2eefb]">{children}</div></TeacherCard>;

const SettingsRow = ({ icon, label, value, trailing }) => <div className="flex min-h-14 items-center gap-3 py-2"><TeacherIcon name={icon} className="size-6 text-[#1555ad]" /><strong className="flex-1 text-lg font-semibold text-[#17488f]">{label}</strong>{trailing ?? <>{value && <span className="font-semibold text-[#176ed0]">{value}</span>}<Chevron className="text-[#1555ad]" /></>}</div>;
