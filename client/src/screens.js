/**
 * The screen registry — every screen in docs/screens/, its route, and whether
 * it is built yet.
 *
 * This drives the index at /screens, which is how the whole prototype gets
 * reviewed in one pass. Keeping `built` honest here is the point: a screen that
 * claims to exist and does not is worse than one openly marked pending.
 *
 * Counted against the files on disk: 41 screenshots, not the 43 INDEX.md
 * claims. INDEX.md lists 7 practice screens; docs/screens/07-practice/ holds 5.
 */
export const FLOWS = [
  {
    id: '01-auth-onboarding',
    label: 'Auth & onboarding',
    screens: [
      { shot: '01-auth-signup-phone', name: 'Sign up / Log in', route: '/auth', built: true },
      { shot: '02-phone-otp-verification', name: 'Phone OTP', route: null, built: false, skipped: 'No SMS provider' },
      { shot: '03-email-code-verification', name: 'Email code', route: null, built: false, skipped: 'No email provider' },
      { shot: '04-role-selection-student-teacher', name: 'Role selection', route: '/onboarding/role', built: true },
      { shot: '05-onboarding-survey', name: 'Survey — step 1', route: '/onboarding/survey/1', built: true },
      { shot: '06-onboarding-step-2', name: 'Survey — step 2', route: '/onboarding/survey/2', built: true },
      { shot: '07-onboarding-step-3', name: 'Survey — step 3', route: '/onboarding/survey/3', built: true },
      { shot: '08-free-vs-plus-comparison', name: 'Free vs Plus', route: '/onboarding/plan', built: true },
    ],
  },
  {
    id: '02-dashboard',
    label: 'Dashboard',
    screens: [
      { shot: '01-dashboard-populated-navy-no-quote', name: 'Home — populated', route: '/', built: true },
      { shot: 'main dashboard', name: 'Home — empty state', route: '/?empty=1', built: true },
      { shot: '03-navy-owl-calendar-top', name: 'Home — owl/calendar header', route: '/?header=calendar', built: false },
    ],
  },
  {
    id: '03-study-kits',
    label: 'Study kits',
    screens: [
      { shot: '01-kits-tab', name: 'Kits tab', route: '/kits', built: true },
      { shot: '02-create-study-folder', name: 'Create folder', route: '/kits/folders/new', built: true },
      { shot: '03-study-kit-file-list', name: 'Kit file list', route: '/kits/kit-database', built: true },
      { shot: '04-add-youtube-url-popup', name: 'Add material', route: '/kits/new', built: true },
      { shot: '05-youtube-url-entry', name: 'YouTube URL entry', route: '/kits/new/youtube', built: true },
      { shot: '06-youtube-processing', name: 'Processing', route: '/kits/new/processing', built: true },
    ],
  },
  {
    id: '04-study-mode-summaries',
    label: 'Study mode & summaries',
    screens: [
      { shot: '01-study-mode-centered-final', name: 'Study mode', route: '/study/kit-database', built: true },
      { shot: '02-five-hour-summary', name: 'Chaptered summary', route: '/study/kit-database/summary', built: true },
      { shot: '03-summary-small-owl', name: 'Chapter summary', route: '/study/kit-database/summary/1', built: true },
      { shot: '04-pdf-viewer-with-chat', name: 'PDF viewer', route: '/study/kit-database/pdf', built: true },
      { shot: '05-pdf-study-actions', name: 'PDF study actions', route: '/study/kit-database/pdf?actions=1', built: true },
    ],
  },
  {
    id: '05-ai-tutor-chat',
    label: 'AI tutor',
    screens: [
      { shot: '01-ai-chat-interface', name: 'Tutor chat', route: '/tutor', built: true },
      { shot: '02-collapsible-ai-tutor-drawer-no-duplicate', name: 'Tutor drawer', route: '/study/kit-database/summary/1?tutor=1', built: true },
    ],
  },
  {
    id: '06-quiz',
    label: 'Quiz',
    screens: [
      { shot: '01-quiz-controls-reordered', name: 'Quiz question', route: '/quiz/kit-database', built: false },
      { shot: '02-quiz-answer-explanation', name: 'Answer explanation', route: '/quiz/kit-database?explain=1', built: false },
      { shot: '03-quiz-completed-results', name: 'Quiz results', route: '/quiz/kit-database/results', built: false },
    ],
  },
  {
    id: '07-practice',
    label: 'Practice',
    screens: [
      { shot: '01-practice-setup', name: 'Practice setup', route: '/practice', built: false },
      { shot: '02-practice-lesson-selection', name: 'Lesson selection', route: '/practice/lessons', built: false },
      { shot: '03-practice-batch-session', name: 'Batch session', route: '/practice/session', built: false },
      { shot: '04-practice-results', name: 'Practice results', route: '/practice/results', built: false },
      { shot: '05-practice-with-mock-exam', name: 'Mock exam', route: '/practice?mock=1', built: false },
    ],
  },
  {
    id: '08-flashcards',
    label: 'Flashcards',
    screens: [
      { shot: '01-flashcards-interface', name: 'Flashcards', route: '/flashcards/kit-database', built: false },
      { shot: '02-flashcards-complete', name: 'Deck complete', route: '/flashcards/kit-database/complete', built: false },
    ],
  },
  {
    id: '09-classes-assignments',
    label: 'Classes & assignments',
    screens: [
      { shot: '01-classes-tab-no-upcoming', name: 'Classes tab', route: '/classes', built: false },
      { shot: '02-class-course-info-lessons-by-week', name: 'Course info', route: '/classes/class-eng', built: false },
      { shot: '03-class-quizzes-folder', name: 'Class quizzes', route: '/classes/class-eng?tab=quizzes', built: false },
      { shot: '04-assignment-detail', name: 'Assignment detail', route: '/assignments/a1', built: false },
      { shot: '05-assignment-detail-upload-file', name: 'Assignment upload', route: '/assignments/a1?upload=1', built: false },
      { shot: '06-assignment-quiz-workspace', name: 'Assignment workspace', route: '/assignments/a1/work', built: false },
    ],
  },
  {
    id: '10-profile',
    label: 'Profile',
    screens: [{ shot: '01-profile-tab', name: 'Profile', route: '/profile', built: false }],
  },
];

export const screenCounts = () => {
  const all = FLOWS.flatMap((f) => f.screens);
  return {
    total: all.length,
    built: all.filter((s) => s.built).length,
    skipped: all.filter((s) => s.skipped).length,
  };
};
