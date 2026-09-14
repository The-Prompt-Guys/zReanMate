import { Link } from 'react-router-dom';

import { Owl, Wordmark } from '../layouts/AuthLayout.jsx';
import { useT } from '../i18n/index.js';

export const NotFoundPage = () => {
  const t = useT();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Owl variant="reading" className="size-24" />
      <Wordmark className="text-2xl" />
      <p className="text-lg font-semibold text-navy-900">{t('errors.notFound')}</p>
      <Link to="/" className="font-semibold text-navy-700 underline">
        {t('common.backHome')}
      </Link>
    </main>
  );
};
