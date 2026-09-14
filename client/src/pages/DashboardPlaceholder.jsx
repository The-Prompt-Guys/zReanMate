import { useAuth } from '../auth/AuthContext.jsx';
import { Button } from '../components/ui.jsx';
import { Owl, Wordmark } from '../layouts/AuthLayout.jsx';
import { LanguageSwitcher, useT } from '../i18n/index.js';

/**
 * Stands in for docs/screens/02-dashboard until session 4. It exists so the
 * auth flow has a real destination and logout can be exercised end to end.
 */
export const DashboardPlaceholder = () => {
  const t = useT();
  const { user, logout } = useAuth();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <Owl variant="waving" className="size-28" />
      <Wordmark className="text-3xl" />
      <h1 className="text-2xl font-bold text-navy-900">
        {t('dashboard.welcome', { name: user?.full_name ?? '' })}
      </h1>
      <p className="text-base text-ink-500">{t('dashboard.comingSoon')}</p>
      <div className="flex w-full max-w-xs flex-col items-center gap-3">
        <LanguageSwitcher className="rounded-full border border-tint-200 bg-white px-4 py-2 text-sm font-semibold text-navy-700" />
        <Button variant="secondary" onClick={logout}>
          {t('auth.logout')}
        </Button>
      </div>
    </main>
  );
};
