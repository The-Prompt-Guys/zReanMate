import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useT } from '../../i18n/index.js';
import { uploadTeacherMaterial } from './useTeacher.js';
import { TeacherButton, TeacherCard, TeacherHeader, TeacherIcon, TeacherIconTile } from './TeacherUI.jsx';

const acceptedTypes = '.pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.txt,.md,.csv,image/*';

export const TeacherUploadMaterialPage = () => {
  const t = useT();
  const navigate = useNavigate();
  const { classId } = useParams();
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [weekNumber, setWeekNumber] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const defaultTitle = useMemo(() => files[0]?.name.replace(/\.[^.]+$/, '') ?? '', [files]);

  const addFiles = (event) => {
    const selected = Array.from(event.target.files ?? []);
    setFiles((current) => [...current, ...selected.filter((file) => !current.some((item) => item.name === file.name && item.size === file.size))]);
    event.target.value = '';
  };

  const submit = async () => {
    if (!files.length) {
      inputRef.current?.click();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const materialTitle = title.trim() || defaultTitle;
      for (const file of files) {
        await uploadTeacherMaterial(classId, { file, title: materialTitle || file.name, weekNumber });
      }
      navigate(`/teacher/classes/${classId}?tab=materials`, { replace: true });
    } catch (cause) {
      setError(cause?.response?.data?.error?.message ?? t('errors.generic'));
      setBusy(false);
    }
  };

  return (
    <main className="teacher-page min-h-full pb-6">
      <TeacherHeader title={t('teacher.uploadMaterial')} backTo={`/teacher/classes/${classId}?tab=materials`} compact />
      <div className="space-y-4 px-5 pt-5">
        <TeacherCard className="space-y-4">
          <h2 className="text-xl font-extrabold text-[#16458e]">{t('teacher.addYourMaterials')}</h2>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-32 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#b9d5f3] bg-[#f5faff] px-5 text-center text-[#1555ad]"
          >
            <TeacherIcon name="upload" className="size-10" />
            <strong className="mt-2 text-base">{t('teacher.dropOrChoose')}</strong>
            <span className="mt-1 text-sm font-semibold text-[#80a4dc]">{t('teacher.materialTypes')}</span>
          </button>
          <input ref={inputRef} type="file" multiple accept={acceptedTypes} className="sr-only" onChange={addFiles} />

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file) => (
                <div key={`${file.name}-${file.size}`} className="flex items-center gap-3 rounded-xl bg-[#f7fbff] p-3 ring-1 ring-[#e1eefb]">
                  <TeacherIconTile name="document" tone={file.type.includes('pdf') ? 'red' : 'gold'} className="size-10 rounded-xl" iconClassName="size-5" />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-[#17488f]">{file.name}</strong>
                    <span className="text-xs font-semibold text-[#80a4dc]">{formatBytes(file.size)}</span>
                  </span>
                  <button type="button" onClick={() => setFiles((current) => current.filter((item) => item !== file))} aria-label={t('common.close')} className="text-[#1555ad]">
                    <TeacherIcon name="close" className="size-5" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => inputRef.current?.click()} className="w-full rounded-full py-2 text-sm font-extrabold text-[#1555ad] ring-1 ring-[#cfe2f8]">
                + {t('teacher.addAnotherFile')}
              </button>
            </div>
          )}
        </TeacherCard>

        <TeacherCard className="space-y-4">
          <h2 className="text-xl font-extrabold text-[#16458e]">{t('teacher.materialDetails')}</h2>
          <label className="block text-sm font-bold text-[#17488f]">
            {t('teacher.materialTitle')}
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={defaultTitle} className="mt-2 w-full rounded-xl border-0 bg-[#f5faff] px-4 py-3 text-base font-semibold text-[#17488f] ring-1 ring-[#dceafb] outline-none" />
          </label>
          <label className="block text-sm font-bold text-[#17488f]">
            {t('teacher.materialDescription')}
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t('teacher.descriptionPlaceholder')} rows={3} className="mt-2 w-full resize-none rounded-xl border-0 bg-[#f5faff] px-4 py-3 text-base font-semibold text-[#17488f] ring-1 ring-[#dceafb] outline-none" />
          </label>
          <p className="text-sm font-semibold text-[#80a4dc]">{t('teacher.materialVisibility')}</p>
          <label className="block text-sm font-bold text-[#17488f]">
            {t('teacher.week')}
            <select value={weekNumber} onChange={(event) => setWeekNumber(Number(event.target.value))} className="mt-2 w-full rounded-xl border-0 bg-[#f5faff] px-4 py-3 text-base font-semibold text-[#17488f] ring-1 ring-[#dceafb] outline-none">
              {Array.from({ length: 52 }, (_, index) => index + 1).map((week) => (
                <option key={week} value={week}>{t('classes.week', { number: week })}</option>
              ))}
            </select>
          </label>
        </TeacherCard>

        {error && <p role="alert" className="rounded-xl bg-danger-50 p-3 text-sm font-semibold text-danger-600">{error}</p>}
        <TeacherButton tone="gold" className="w-full" onClick={submit} disabled={busy}>
          <TeacherIcon name="upload" className="size-5" />
          {busy ? t('common.loading') : t('teacher.uploadMaterial')}
        </TeacherButton>
        <button type="button" onClick={() => navigate(`/teacher/classes/${classId}?tab=materials`)} className="w-full py-1 text-base font-extrabold text-[#1555ad]">
          {t('common.cancel')}
        </button>
      </div>
    </main>
  );
};

const formatBytes = (bytes) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
