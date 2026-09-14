import { createBrowserRouter, Navigate } from 'react-router-dom';

import { RequireAuth, RequireGuest, RequireOnboarded } from '../auth/guards.jsx';
import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { AppLayout } from '../layouts/AppLayout.jsx';
import { AuthPage } from '../pages/AuthPage.jsx';
import { RoleSelectionPage } from '../pages/RoleSelectionPage.jsx';
import { SurveyPage } from '../pages/SurveyPage.jsx';
import { PlanPage } from '../pages/PlanPage.jsx';
import { DashboardPage } from '../pages/DashboardPage.jsx';
import { KitsPage } from '../pages/kits/KitsPage.jsx';
import { KitDetailPage } from '../pages/kits/KitDetailPage.jsx';
import { StudyModePage } from '../pages/study/StudyModePage.jsx';
import { SummaryPage } from '../pages/study/SummaryPage.jsx';
import { ChapterSummaryPage } from '../pages/study/ChapterSummaryPage.jsx';
import { PdfViewerPage } from '../pages/study/PdfViewerPage.jsx';
import { TutorPage } from '../pages/tutor/TutorPage.jsx';
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
import {
  AddMaterialSheet,
  CreateKitSheet,
  ProcessingSheet,
  UploadingSheet,
  YouTubeUrlSheet,
} from '../pages/kits/sheets.jsx';
import { ScreenIndexPage } from '../pages/ScreenIndexPage.jsx';
import { PendingScreenPage } from '../pages/PendingScreenPage.jsx';
import { FLOWS } from '../screens.js';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';

/** The study-mode chooser is a dialog layered over the kit it belongs to. */
const StudyOver = () => (
  <>
    <KitDetailPage />
    <StudyModePage />
  </>
);

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
 *   RequireGuest     — signed-out only.
 *   RequireAuth      — signed in; onboarding may still be unfinished.
 *   RequireOnboarded — signed in AND finished; the app proper.
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
          { path: '/onboarding/role', element: <RoleSelectionPage /> },
          { path: '/onboarding/survey/:step', element: <SurveyPage /> },
          { path: '/onboarding/survey', element: <Navigate to="/onboarding/survey/1" replace /> },
          { path: '/onboarding/plan', element: <PlanPage /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequireOnboarded />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/', element: <DashboardPage /> },

              // Study kits. Create sheets layer over the Kits tab; add-to-kit
              // sheets layer over that kit's file list so students stay put.
              { path: '/kits', element: <KitsPage /> },
              { path: '/kits/new', element: <SheetOver sheet={<AddMaterialSheet />} /> },
              { path: '/kits/new/youtube', element: <SheetOver sheet={<YouTubeUrlSheet />} /> },
              { path: '/kits/new/processing', element: <SheetOver sheet={<ProcessingSheet />} /> },
              { path: '/kits/folders/new', element: <SheetOver sheet={<CreateKitSheet />} /> },
              { path: '/kits/:kitId/add', element: <KitSheetOver sheet={<AddMaterialSheet />} /> },
              { path: '/kits/:kitId/add/youtube', element: <KitSheetOver sheet={<YouTubeUrlSheet />} /> },
              { path: '/kits/:kitId/add/processing', element: <KitSheetOver sheet={<ProcessingSheet />} /> },
              // Real file upload, with progress driven by the request itself.
              { path: '/kits/:kitId/add/uploading', element: <KitSheetOver sheet={<UploadingSheet />} /> },
              { path: '/kits/:kitId', element: <KitDetailPage /> },

              // Study mode. The chooser is a centered dialog over the kit, and
              // the PDF study actions are a sheet over the viewer (?actions=1).
              { path: '/study/:kitId', element: <StudyOver /> },
              { path: '/study/:kitId/summary', element: <SummaryPage /> },
              { path: '/study/:kitId/summary/:chapter', element: <ChapterSummaryPage /> },
              { path: '/study/:kitId/pdf', element: <PdfViewerPage /> },

              // AI tutor
              { path: '/tutor', element: <TutorPage /> },

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

              // Profile
              { path: '/profile', element: <ProfilePage /> },

              // Every registered screen that is not built yet still resolves,
              // so the tab bar and the index never dead-end on a 404.
              ...pendingRoutes,
            ],
          },
        ],
      },
    ],
  },

  // Prototype-only review tool, outside every guard and layout.
  { path: '/screens', element: <ScreenIndexPage /> },

  { path: '*', element: <NotFoundPage /> },
]);
