import { useCallback, useEffect, useState } from 'react';
import { api, toFormError } from '../lib/api.js';

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
