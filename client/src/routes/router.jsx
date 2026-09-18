import { createBrowserRouter, Navigate } from 'react-router-dom';

import {
  RequireAuth,
  RequireGuest,
  RequireStudentOnboarding,
  RequireTeacher,
  RoleHomeRedirect,
} from '../auth/guards.jsx';
import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { AppLayout } from '../layouts/AppLayout.jsx';
import { AuthPage } from '../pages/AuthPage.jsx';
import { SurveyPage } from '../pages/SurveyPage.jsx';
import { DashboardPage } from '../pages/DashboardPage.jsx';
import { KitsPage } from '../pages/kits/KitsPage.jsx';
import { KitDetailPage } from '../pages/kits/KitDetailPage.jsx';
import { StudyModePage } from '../pages/study/StudyModePage.jsx';
import { SummaryPage } from '../pages/study/SummaryPage.jsx';
import { StudyGuidePage } from '../pages/study/StudyGuidePage.jsx';
import { ChapterSummaryPage } from '../pages/study/ChapterSummaryPage.jsx';
import { PdfViewerPage } from '../pages/study/PdfViewerPage.jsx';
import { TutorPage } from '../pages/tutor/TutorPage.jsx';
import { TutorSourceSheet } from '../pages/tutor/TutorSourceSheet.jsx';
import { AssistantScreen } from '../pages/assistant/AssistantScreen.jsx';
import { QuizPage } from '../pages/quiz/QuizPage.jsx';
import { QuizResultsPage } from '../pages/quiz/QuizResultsPage.jsx';
import { PracticeHomePage } from '../pages/practice/PracticeHomePage.jsx';
import { PracticeSetupPage } from '../pages/practice/PracticeSetupPage.jsx';
import { PracticeLessonsPage } from '../pages/practice/PracticeLessonsPage.jsx';
import { PracticeSessionPage } from '../pages/practice/PracticeSessionPage.jsx';
import { PracticeResultsPage } from '../pages/practice/PracticeResultsPage.jsx';
import { FlashcardsPage } from '../pages/flashcards/FlashcardsPage.jsx';
import { FlashcardsCompletePage } from '../pages/flashcards/FlashcardsCompletePage.jsx';
import { ClassesPage } from '../pages/classes/ClassesPage.jsx';
import { ClassDetailPage } from '../pages/classes/ClassDetailPage.jsx';
import { AssignmentDetailPage } from '../pages/classes/AssignmentDetailPage.jsx';
import { AssignmentWorkspacePage } from '../pages/classes/AssignmentWorkspacePage.jsx';
import { ProfilePage } from '../pages/ProfilePage.jsx';
import { TeacherClassesPage } from '../pages/teacher/TeacherClassesPage.jsx';
import { TeacherDashboardPage } from '../pages/teacher/TeacherDashboardPage.jsx';
import { TeacherClassDetailPage } from '../pages/teacher/TeacherClassDetailPage.jsx';
import { TeacherAssignmentsPage } from '../pages/teacher/TeacherAssignmentsPage.jsx';
import { TeacherCreateAssignmentPage } from '../pages/teacher/TeacherCreateAssignmentPage.jsx';
import { TeacherCalendarPage } from '../pages/teacher/TeacherCalendarPage.jsx';
import { TeacherAssistantPage } from '../pages/teacher/TeacherAssistantPage.jsx';
import { TeacherCreateClassSheet } from '../pages/teacher/TeacherCreateClassSheet.jsx';
import { TeacherUploadMaterialPage } from '../pages/teacher/TeacherUploadMaterialPage.jsx';
import { TeacherGradeSubmissionPage, TeacherSubmissionListPage } from '../pages/teacher/TeacherSubmissionPages.jsx';
import { TeacherProfilePage } from '../pages/teacher/TeacherProfilePage.jsx';
import {
  AddMaterialSheet,
  ChooseKitSheet,
  DeleteFileSheet,
  DeleteKitSheet,
  PhotoPickSheet,
  PdfPickSheet,
  TopicSheet,
  CreateKitSheet,
  ProcessingSheet,
  UploadingSheet,
  YouTubeUrlSheet,
} from '../pages/kits/sheets.jsx';
import { CameraSheet } from '../pages/kits/CameraSheet.jsx';
import { ScreenIndexPage } from '../pages/ScreenIndexPage.jsx';
import { PendingScreenPage } from '../pages/PendingScreenPage.jsx';
import { FLOWS } from '../screens.js';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';

/** Renders a sheet over the Kits tab so create/add stays in the kits section. */
const SheetOver = ({ sheet }) => (
  <>
    <KitsPage />
    {sheet}
  </>
);

/** Add-material sheets layered over a specific kit's file list. */
const KitSheetOver = ({ sheet }) => (
  <>
    <KitDetailPage />
    {sheet}
  </>
);

/**
 * Routes for registry entries that have a path but no page yet. Built screens
 * are declared explicitly in the tree below, which is matched first, so a
 * built screen always wins over its pending entry.
 */
const pendingRoutes = FLOWS.flatMap((flow) => flow.screens)
  .filter((screen) => !screen.built && screen.route)
  .map((screen) => ({ path: screen.route.split('?')[0], element: <PendingScreenPage /> }));

/**
 * Three zones, each behind its own guard:
 *
 *   RequireGuest — signed-out only.
 *   RequireAuth  — signed in. Onboarding may be unfinished: it is a signup
 *                  wizard, not a gate, so an existing account reaches the app
 *                  whether or not it ever completed the survey.
 *
 * In prototype mode every guard passes through, so all screens are reachable
 * by URL — see src/mock/mode.js and the index at /screens.
 *
 * The OTP and email-code screens from docs/screens/01-auth-onboarding/02 and 03
 * are deliberately absent: no SMS or email provider exists. The screenshots
 * stay in docs/.
 */
export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      {
        element: <RequireGuest />,
        children: [{ path: '/auth', element: <AuthPage /> }],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <RequireStudentOnboarding />,
            children: [
              { path: '/onboarding/survey/:step', element: <SurveyPage /> },
              { path: '/onboarding/survey', element: <Navigate to="/onboarding/survey/1" replace /> },
              { path: '/onboarding/plan', element: <Navigate to="/" replace /> },
            ],
          },
        ],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <RoleHomeRedirect /> },
          { path: '/student', element: <DashboardPage /> },

          // Study kits. Create sheets layer over the Kits tab; add-to-kit
          // sheets layer over that kit's file list so students stay put.
          { path: '/kits', element: <KitsPage /> },
          { path: '/kits/add', element: <SheetOver sheet={<ChooseKitSheet />} /> },
          { path: '/kits/new', element: <SheetOver sheet={<CreateKitSheet />} /> },
          { path: '/kits/new/photo', element: <SheetOver sheet={<PhotoPickSheet />} /> },
          { path: '/kits/new/photo/camera', element: <SheetOver sheet={<CameraSheet />} /> },
          { path: '/kits/new/pdf', element: <SheetOver sheet={<PdfPickSheet />} /> },
          { path: '/kits/new/youtube', element: <SheetOver sheet={<YouTubeUrlSheet />} /> },
          { path: '/kits/new/topic', element: <SheetOver sheet={<TopicSheet />} /> },
          { path: '/kits/new/processing', element: <SheetOver sheet={<ProcessingSheet />} /> },
          { path: '/kits/folders/new', element: <SheetOver sheet={<CreateKitSheet />} /> },
          { path: '/kits/:kitId/add', element: <KitSheetOver sheet={<AddMaterialSheet />} /> },
          { path: '/kits/:kitId/add/photo', element: <KitSheetOver sheet={<PhotoPickSheet />} /> },
          { path: '/kits/:kitId/add/photo/camera', element: <KitSheetOver sheet={<CameraSheet />} /> },
          { path: '/kits/:kitId/add/pdf', element: <KitSheetOver sheet={<PdfPickSheet />} /> },
          { path: '/kits/:kitId/add/youtube', element: <KitSheetOver sheet={<YouTubeUrlSheet />} /> },
          { path: '/kits/:kitId/add/topic', element: <KitSheetOver sheet={<TopicSheet />} /> },
          { path: '/kits/:kitId/add/processing', element: <KitSheetOver sheet={<ProcessingSheet />} /> },
          // Real file upload, with progress driven by the request itself.
          { path: '/kits/:kitId/add/uploading', element: <KitSheetOver sheet={<UploadingSheet />} /> },
          { path: '/kits/:kitId/delete', element: <KitSheetOver sheet={<DeleteKitSheet />} /> },
          { path: '/kits/:kitId/files/:fileId/delete', element: <KitSheetOver sheet={<DeleteFileSheet />} /> },
          { path: '/kits/:kitId', element: <KitDetailPage /> },

          // Study mode. The chooser is a centered dialog over the kit, and
          // the PDF study actions are a sheet over the viewer (?actions=1).
          // The chooser is its own screen now, carrying the kit's header —
          // it used to be a dialog layered over the kit detail page.
          { path: '/study/:kitId', element: <StudyModePage /> },
          { path: '/study/:kitId/guide', element: <StudyGuidePage /> },
          { path: '/study/:kitId/summary', element: <SummaryPage /> },
          { path: '/study/:kitId/summary/:chapter', element: <ChapterSummaryPage /> },
          { path: '/study/:kitId/pdf', element: <PdfViewerPage /> },

          // AI tutor
          { path: '/assistant', element: <AssistantScreen /> },
          { path: '/tutor', element: <TutorPage /> },
          {
            path: '/tutor/source',
            element: <><TutorPage /><TutorSourceSheet /></>,
          },

          // Quiz. These screens use the contextual Practice / Learn /
          // Flashcards / More bar, so AppLayout hides the app tab bar.
          { path: '/quiz/:kitId', element: <QuizPage /> },
          { path: '/quiz/:kitId/results', element: <QuizResultsPage /> },

          // Practice
          { path: '/practice', element: <PracticeHomePage /> },
          { path: '/practice/setup', element: <PracticeSetupPage /> },
          { path: '/practice/lessons', element: <PracticeLessonsPage /> },
          { path: '/practice/session', element: <PracticeSessionPage /> },
          { path: '/practice/results', element: <PracticeResultsPage /> },

          // Flashcards (contextual tab bar, like quiz)
          { path: '/flashcards/:kitId', element: <FlashcardsPage /> },
          { path: '/flashcards/:kitId/complete', element: <FlashcardsCompletePage /> },

          // Classes and assignments
          { path: '/classes', element: <ClassesPage /> },
          { path: '/classes/:classId', element: <ClassDetailPage /> },
          { path: '/assignments/:assignmentId', element: <AssignmentDetailPage /> },
          { path: '/assignments/:assignmentId/work', element: <AssignmentWorkspacePage /> },

          // Teacher flows
          {
            element: <RequireTeacher />,
            children: [
              { path: '/teacher', element: <TeacherDashboardPage /> },
              { path: '/teacher/classes', element: <TeacherClassesPage /> },
              { path: '/teacher/classes/new', element: <><TeacherClassesPage /><TeacherCreateClassSheet /></> },
              { path: '/teacher/classes/:classId', element: <TeacherClassDetailPage /> },
              { path: '/teacher/classes/:classId/materials/new', element: <TeacherUploadMaterialPage /> },
              { path: '/teacher/assignments', element: <TeacherAssignmentsPage /> },
              { path: '/teacher/assignments/new', element: <TeacherCreateAssignmentPage /> },
              { path: '/teacher/quizzes/new', element: <TeacherCreateAssignmentPage /> },
              { path: '/teacher/assignments/:assignmentId', element: <TeacherSubmissionListPage /> },
              { path: '/teacher/assignments/:assignmentId/edit', element: <TeacherCreateAssignmentPage /> },
              { path: '/teacher/assignments/:assignmentId/submissions/:studentId', element: <TeacherGradeSubmissionPage /> },
              { path: '/teacher/calendar', element: <TeacherCalendarPage /> },
              { path: '/teacher/assistant', element: <TeacherAssistantPage /> },
              { path: '/teacher/profile', element: <TeacherProfilePage /> },
            ],
          },

          // Profile
          { path: '/profile', element: <ProfilePage /> },

          // Every registered screen that is not built yet still resolves,
          // so the tab bar and the index never dead-end on a 404.
          ...pendingRoutes,
        ],
      },
    ],
  },

  // Prototype-only review tool, outside every guard and layout.
  { path: '/screens', element: <ScreenIndexPage /> },

  { path: '*', element: <NotFoundPage /> },
]);
