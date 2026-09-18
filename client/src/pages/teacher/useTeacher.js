import { useCallback, useEffect, useState } from 'react';

import { api, toFormError } from '../../lib/api.js';

const useRequest = (request, initial = null) => {
  const [data, setData] = useState(initial);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const response = await request();
      setData(response.data);
      setStatus('ready');
      setError(null);
      return response.data;
    } catch (cause) {
      setStatus('error');
      setError(toFormError(cause));
      return null;
    }
  }, [request]);

  useEffect(() => { refresh(); }, [refresh]);
  return { data, status, error, refresh };
};

export const useTeacherDashboard = () => {
  const request = useCallback(() => api.get('/teacher/dashboard'), []);
  return useRequest(request, {
    summary: { activeClasses: 0, totalStudents: 0, pendingReviews: 0, returnedSubmissions: 0 },
    classes: [],
    assignments: [],
  });
};

export const useTeacherAssignments = () => {
  const request = useCallback(() => api.get('/teacher/assignments'), []);
  return useRequest(request, { assignments: [] });
};

export const useTeacherAssignment = (assignmentId) => useRequest(
  useCallback(() => assignmentId ? api.get(`/teacher/assignments/${assignmentId}`) : Promise.resolve({ data: { assignment: null } }), [assignmentId]),
  { assignment: null },
);

export const updateTeacherAssignment = async (assignmentId, input) => {
  const { data } = await api.patch(`/teacher/assignments/${assignmentId}`, input);
  return data.assignment;
};

export const deleteTeacherAssignment = async (assignmentId) => {
  const { data } = await api.delete(`/teacher/assignments/${assignmentId}`);
  return data;
};

export const useTeacherSubmissions = (assignmentId) => useRequest(
  useCallback(() => api.get(`/assignments/${assignmentId}/submissions`), [assignmentId]),
  { submissions: [] },
);

export const gradeTeacherSubmission = async (assignmentId, submissionId, input) => {
  const { data } = await api.patch(`/assignments/${assignmentId}/submissions/${submissionId}`, input);
  return data.submission;
};

export const useTeacherClassStudents = (classId) => useRequest(
  useCallback(() => api.get(`/teacher/classes/${classId}/students`), [classId]),
  { students: [] },
);

export const useTeacherMaterials = (classId) => useRequest(
  useCallback(() => classId
    ? api.get(`/teacher/classes/${classId}/materials`)
    : Promise.resolve({ data: { materials: [] } }), [classId]),
  { materials: [] },
);

export const createTeacherClass = async (input, coverFile) => {
  const { data } = await api.post('/classes', input);
  if (coverFile) {
    const body = new FormData();
    body.append('file', coverFile);
    await api.post(`/classes/${data.class.id}/cover`, body, { headers: { 'Content-Type': undefined } });
  }
  return data.class;
};

export const createTeacherAssignment = async (input) => {
  const { data } = await api.post('/teacher/assignments', input);
  return data.assignment;
};

export const createTeacherQuiz = async (input) => {
  const { data } = await api.post('/teacher/quizzes', input);
  return data;
};

export const uploadTeacherAssignmentAttachment = async (assignmentId, file) => {
  const body = new FormData();
  body.append('file', file);
  const { data } = await api.post(`/teacher/assignments/${assignmentId}/attachment`, body, {
    headers: { 'Content-Type': undefined },
  });
  return data.material;
};

export const uploadTeacherMaterial = async (classId, { file, title, weekNumber }) => {
  const body = new FormData();
  body.append('file', file);
  if (title) body.append('title', title);
  if (weekNumber) body.append('weekNumber', String(weekNumber));
  const { data } = await api.post(`/teacher/classes/${classId}/materials`, body, {
    headers: { 'Content-Type': undefined },
  });
  return data.material;
};

export const deleteTeacherMaterial = async (classId, materialId) => {
  const { data } = await api.delete(`/teacher/classes/${classId}/materials/${materialId}`);
  return data;
};

export const deleteTeacherClass = async (classId) => {
  const { data } = await api.delete(`/classes/${classId}`);
  return data;
};

export const updateTeacherClass = async (classId, input) => {
  const { data } = await api.patch(`/teacher/classes/${classId}`, input);
  return data.class;
};

export const askTeacherAssistant = async (input) => {
  const { data } = await api.post('/teacher/assistant/ask', input);
  return data;
};

export const useTeacherAssistantHistory = () => useRequest(
  useCallback(() => api.get('/teacher/assistant/history'), []),
  { conversations: [] },
);

export const clearTeacherAssistantHistory = async () => {
  const { data } = await api.delete('/teacher/assistant/history');
  return data;
};

export const generateTeacherQuiz = async (input) => {
  const { data } = await api.post('/teacher/assistant/quiz', input);
  return data.draft;
};
