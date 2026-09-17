import { useCallback, useEffect, useRef, useState } from 'react';

import { api, toFormError } from '../lib/api.js';

export const quizAttemptStorageKey = (kitId, sourceId, language) =>
  `reanmate:quiz-attempt:${kitId}:${sourceId ?? 'unknown'}:${language}`;

export const quizSourceStorageKey = (kitId, language) =>
  `reanmate:quiz-source:${kitId}:${language}`;

export const shouldReuseStoredQuizAttempt = (attemptId, forceNew = false) => !!attemptId && !forceNew;

export const useQuizAttempt = ({ kitId, source, language, forceNew = false }) => {
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const initializing = useRef(false);

  const loadAttempt = useCallback(async (attemptId) => {
    const { data } = await api.get(`/attempts/${attemptId}`);
    setAttempt(data.attempt);
    setQuestions(data.questions);
    setStatus(data.attempt.status === 'submitted' ? 'submitted' : 'ready');
    return data;
  }, []);

  const initialize = useCallback(async () => {
    if (!kitId || !source?.id || source.status !== 'ready' || initializing.current) return;
    initializing.current = true;
    setError(null);
    try {
      const sourceKey = source?.id ?? 'unknown';
      const storageKey = quizAttemptStorageKey(kitId, sourceKey, language);
      const existing = window.localStorage.getItem(storageKey);

      if (existing && shouldReuseStoredQuizAttempt(existing, forceNew)) {
        try {
          const loaded = await loadAttempt(existing);
          if (loaded.attempt.status !== 'submitted') return;
          window.localStorage.removeItem(storageKey);
        } catch {
          window.localStorage.removeItem(storageKey);
        }
      }

      if (forceNew) {
        window.localStorage.removeItem(storageKey);
      }

      setStatus('generating');
      let generated;
      do {
        generated = (await api.post(`/sources/${source.id}/quiz`, { language, difficulty: 'mixed' })).data;
        if (generated.status === 'failed') throw new Error('Quiz generation failed validation');
        if (generated.status !== 'ready') await new Promise((resolve) => window.setTimeout(resolve, 1000));
      } while (generated.status !== 'ready');
      const { data } = await api.post(`/quizzes/${generated.quiz.id}/attempts`);
      window.localStorage.setItem(storageKey, data.attempt.id);
      window.localStorage.setItem(quizSourceStorageKey(kitId, language), sourceKey);
      setAttempt(data.attempt);
      setQuestions(data.questions);
      setStatus('ready');
    } catch (err) {
      setError(toFormError(err));
      setStatus('error');
    } finally { initializing.current = false; }
  }, [kitId, source, language, loadAttempt, forceNew]);

  useEffect(() => { void initialize(); }, [initialize]);

  const answer = useCallback(async (questionId, response) => {
    const { data } = await api.put(`/attempts/${attempt.id}/answers`, { questionId, response });
    setQuestions((current) => current.map((question) => question.id === questionId
      ? { ...question, response: data.answer.response, isCorrect: data.answer.isCorrect,
        correctAnswer: data.answer.correctAnswer, explanation: data.answer.explanation }
      : question));
    return data.answer;
  }, [attempt]);

  const submit = useCallback(async () => {
    const { data } = await api.post(`/attempts/${attempt.id}/submit`);
    setAttempt(data.attempt);
    setStatus('submitted');
    return data.attempt;
  }, [attempt]);

  return { attempt, questions, status, error, answer, submit, loadAttempt };
};
