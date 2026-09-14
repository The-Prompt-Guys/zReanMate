import { useCallback, useEffect, useState } from 'react';

import { api, toFormError } from '../../lib/api.js';

export const useAssignment = (assignmentId, { questions = false } = {}) => {
  const [data, setData] = useState(null);
  const [questionList, setQuestionList] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const refresh = useCallback(async () => {
    try {
      const requests = [api.get(`/assignments/${assignmentId}`)];
      if (questions) requests.push(api.get(`/assignments/${assignmentId}/questions`));
      const responses = await Promise.all(requests);
      setData(responses[0].data);
      if (questions) setQuestionList(responses[1].data.questions);
      setStatus('ready'); setError(null);
    } catch (err) { setError(toFormError(err)); setStatus('error'); }
  }, [assignmentId, questions]);
  useEffect(() => { refresh(); }, [refresh]);

  const saveAnswers = useCallback(async (answers, submit = false) => {
    const response = await api.put(`/assignments/${assignmentId}/submission`, { answers, submit });
    setData((current) => ({ ...current, submission: response.data.submission }));
    return response.data.submission;
  }, [assignmentId]);

  const upload = useCallback(async (file) => {
    const body = new FormData(); body.append('file', file);
    const response = await api.post(`/assignments/${assignmentId}/submission/files`, body, {
      headers: { 'Content-Type': undefined },
    });
    await refresh();
    return response.data;
  }, [assignmentId, refresh]);

  return { data, questions: questionList, status, error, refresh, saveAnswers, upload };
};
