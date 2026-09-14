import { useCallback, useEffect, useState } from 'react';
import { api, toFormError } from '../lib/api.js';

/**
 * plan_limits rows are database keys, so they have no i18n key of their own —
 * each needs a label in km and en. Shared by the profile and plan screens so
 * the two cannot drift. A key with no label here is not rendered.
 */
export const LIMIT_LABELS = {
  max_kits: 'plan.limitMaxKits',
  practice_sessions_per_week: 'plan.limitPracticeSessionsPerWeek',
  tutor_messages_per_month: 'plan.limitTutorMessagesPerMonth',
};

export const useProfile = () => {
  const [profile, setProfile] = useState(null);
  const [limits, setLimits] = useState(null);
  const [error, setError] = useState(null);
  const refresh = useCallback(async () => {
    try {
      const [profileResponse, limitsResponse] = await Promise.all([api.get('/profile'), api.get('/me/limits')]);
      setProfile(profileResponse.data.profile); setLimits(limitsResponse.data); setError(null);
    } catch (err) { setError(toFormError(err)); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const update = useCallback(async (patch) => {
    const { data } = await api.patch('/profile', patch); setProfile(data.profile); return data.profile;
  }, []);
  return { profile, limits, error, refresh, update };
};
