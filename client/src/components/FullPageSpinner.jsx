import { useT } from '../i18n/index.js';

export const FullPageSpinner = () => {
  const t = useT();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas" role="status">
      <span
        className="size-8 animate-spin rounded-full border-3 border-tint-200 border-t-navy-800"
        aria-hidden="true"
      />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
};
