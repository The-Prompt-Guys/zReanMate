import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  BottomSheet,
  SheetButton,
  SheetField,
  SheetHeading,
  SheetSubtitle,
} from '../../components/BottomSheet.jsx';
import { useT } from '../../i18n/index.js';
import { createTeacherClass } from './useTeacher.js';

export const TeacherCreateClassSheet = () => {
  const t = useT();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createTeacherClass({ title: title.trim(), weekCount: 12 }, coverFile);
      navigate('/teacher/classes', { replace: true });
    } catch (cause) {
      setError(cause?.response?.data?.error?.message ?? t('errors.generic'));
      setBusy(false);
    }
  };

  return (
    <BottomSheet closeTo="/teacher/classes" labelledBy="create-class-title">
      <form onSubmit={submit} className="space-y-5">
        <SheetHeading
          id="create-class-title"
          tone="blue"
          icon={<GraduationIcon />}
          title={t('teacher.createClassTitle')}
          subtitle={t('teacher.createClassSubtitle')}
        />

        <div className="space-y-2">
          <label htmlFor="teacher-class-name" className="block text-lg font-extrabold text-navy-900">{t('teacher.classTitle')}</label>
          <SheetField
            id="teacher-class-name"
            label={t('teacher.classTitle')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('teacher.classTitlePlaceholder')}
            autoFocus
            required
          />
        </div>

        <div className="space-y-2">
          <p className="text-lg font-extrabold text-navy-900">{t('teacher.classPicture')}</p>
          <div className="rounded-2xl bg-tint-100 p-4 text-brand-600 ring-1 ring-tint-200">
            <div className="flex items-center gap-3">
              <ImageIcon />
              <div>
                <p className="font-extrabold text-navy-900">{t('teacher.addClassPicture')}</p>
                <label htmlFor="teacher-class-cover" className="cursor-pointer text-left text-sm font-semibold text-brand-600 underline">
                  {t('teacher.chooseFromGallery')}
                  <input id="teacher-class-cover" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setCoverFile(file);
                    setCoverPreview(file ? URL.createObjectURL(file) : null);
                  }} />
                </label>
              </div>
            </div>
            {coverPreview && <img src={coverPreview} alt={t('teacher.classPicture')} className="mt-3 h-28 w-full rounded-xl object-cover" />}
          </div>
        </div>

        {error && <p role="alert" className="rounded-xl bg-red-100 px-3 py-2 text-sm text-red-800">{error}</p>}
        <SheetButton type="submit" disabled={busy || !title.trim()}>{t('teacher.createClass')}</SheetButton>
        <button type="button" onClick={() => navigate('/teacher/classes')} className="w-full py-1 text-lg font-extrabold text-brand-600">{t('common.cancel')}</button>
      </form>
    </BottomSheet>
  );
};

const GraduationIcon = () => (
  <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m2.5 9 9.5-5 9.5 5-9.5 5z" /><path d="M6 11.2v5.1c2.9 2.1 9.1 2.1 12 0v-5.1" /><path d="M21.5 9v6" />
  </svg>
);

const ImageIcon = () => (
  <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4 17 5-5 3.5 3 2.5-2.5 5 5" />
  </svg>
);
