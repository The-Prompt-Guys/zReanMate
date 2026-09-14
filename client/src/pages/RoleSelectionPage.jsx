import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext.jsx';
import { Button, FormAlert, OptionCard, SegmentedProgress, TextButton } from '../components/ui.jsx';
import { Owl, Wordmark } from '../layouts/AuthLayout.jsx';
import { toFormError } from '../lib/api.js';
import { useT } from '../i18n/index.js';

/**
 * docs/screens/01-auth-onboarding/04-role-selection-student-teacher.
 *
 * "I'll choose later" leaves users.role null — the column is nullable exactly
 * for this — and still advances, so the flow is never a dead end.
 */
export const RoleSelectionPage = () => {
  const t = useT();
  const navigate = useNavigate();
  const { chooseRole } = useAuth();

  const [role, setRole] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  const submit = async () => {
    if (!role) return;
    setBusy(true);
    setFormError(null);
    try {
      await chooseRole(role);
      navigate('/onboarding/survey/1');
    } catch (error) {
      const { code, message } = toFormError(error);
      setFormError(code === 'network' ? t('errors.network') : (message ?? t('errors.generic')));
      setBusy(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex flex-col items-center pt-6 text-center">
        <Owl variant="default" className="size-28" />
        <Wordmark className="mt-1 text-4xl" />
      </header>

      <div className="mt-6">
        <SegmentedProgress current={1} total={4} label={t('onboarding.oneLastStep')} />
      </div>

      <h1 className="mt-6 text-center text-2xl font-bold leading-tight text-navy-900">
        {t('onboarding.roleTitle')}
      </h1>
      <p className="mt-2 text-center text-base text-ink-500">{t('onboarding.roleSubtitle')}</p>

      <div className="mt-7 space-y-3" role="radiogroup" aria-label={t('onboarding.roleTitle')}>
        <OptionCard
          name="role"
          value="student"
          checked={role === 'student'}
          onChange={setRole}
          icon={<StudentIcon />}
          title={t('onboarding.roleStudent')}
          description={t('onboarding.roleStudentHint')}
        />
        <OptionCard
          name="role"
          value="teacher"
          checked={role === 'teacher'}
          onChange={setRole}
          icon={<TeacherIcon />}
          title={t('onboarding.roleTeacher')}
          description={t('onboarding.roleTeacherHint')}
        />
      </div>

      <div className="mt-8 space-y-4">
        <FormAlert>{formError}</FormAlert>
        <Button onClick={submit} disabled={!role || busy}>
          {busy ? t('common.loading') : t('common.continue')}
        </Button>
        <div className="text-center">
          <TextButton onClick={() => navigate('/onboarding/survey/1')}>
            {t('onboarding.chooseLater')}
          </TextButton>
        </div>
      </div>
    </main>
  );
};

const StudentIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" className="size-11" aria-hidden="true">
    <path d="M24 6 43 14 24 22 5 14 24 6Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M12 18v7c0 3.3 5.4 6 12 6s12-2.7 12-6v-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M41 15v8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M17 42a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

const TeacherIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" className="size-11" aria-hidden="true">
    <rect x="17" y="8" width="26" height="20" rx="2.5" stroke="currentColor" strokeWidth="2.4" />
    <path d="M22 15h13M22 21h8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="10" cy="15" r="4" stroke="currentColor" strokeWidth="2.4" />
    <path d="M4 40v-7a6 6 0 0 1 12 0v7M16 28l6-3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);
