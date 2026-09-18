export const teacherRoutes = [
  { path: '/teacher/classes', element: 'TeacherClassesPage' },
  { path: '/teacher/classes/:classId', element: 'TeacherClassDetailPage' },
  { path: '/teacher/assignments', element: 'TeacherAssignmentsPage' },
  { path: '/teacher/assignments/new', element: 'TeacherCreateAssignmentPage' },
  { path: '/teacher/quizzes/new', element: 'TeacherCreateAssignmentPage' },
  { path: '/teacher/assignments/:assignmentId', element: 'TeacherSubmissionListPage' },
  { path: '/teacher/assignments/:assignmentId/submissions/:studentId', element: 'TeacherGradeSubmissionPage' },
  { path: '/teacher/calendar', element: 'TeacherCalendarPage' },
  { path: '/teacher/assistant', element: 'TeacherAssistantPage' },
  { path: '/teacher/profile', element: 'TeacherProfilePage' },
];

export const teacherTabRoutes = [
  { to: '/teacher/classes', label: 'Classes' },
  { to: '/teacher/assignments', label: 'Assignments' },
  { to: '/teacher/calendar', label: 'Calendar' },
  { to: '/teacher/profile', label: 'Profile' },
];
