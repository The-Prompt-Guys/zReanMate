/**
 * Prototype fixtures.
 *
 * The client runs standalone while the backend is on hold, so every screen
 * reads from here instead of the API. Shapes deliberately mirror the real
 * responses (snake_case where it comes from a database row, camelCase where the
 * AI layer produces it), so swapping in the real endpoints later is a change of
 * source, not a rewrite of every component.
 *
 * Text lives here rather than in i18n on purpose: this is *content* standing in
 * for a student's own uploads, not UI chrome. UI chrome still goes through t().
 */

export const mockUser = {
  id: '11111111-1111-1111-1111-111111111111',
  full_name: 'Sokchea',
  email: 'sokchea@example.com',
  phone: null,
  avatar_url: null,
  role: 'student',
  locale: 'km',
  plan_tier: 'free',
  plan_status: 'active',
  trial_ends_at: null,
  onboarding_completed_at: '2026-09-01T09:00:00Z',
};

export const mockOnboarding = {
  roleChosen: true,
  surveyAnswers: {
    improveFirst: 'understand_topics',
    studyStyle: 'mix',
    studyFrequency: 'few_times_week',
  },
  surveySkipped: false,
  completedAt: '2026-09-01T09:00:00Z',
};

/** Accent tiles on the kit cards — colour + icon per docs/screens/02-dashboard/01. */
export const kits = [
  {
    id: 'kit-academic',
    title: 'Academic Paragraphs',
    titleKm: 'កថាខណ្ឌសិក្សា',
    icon: 'document',
    accent: 'blue',
    cardCount: 12,
    progress: 62,
    status: 'in_progress',
    sourceKind: 'pdf',
  },
  {
    id: 'kit-database',
    title: 'Introduction to Database Systems',
    titleKm: 'ការណែនាំអំពីប្រព័ន្ធមូលដ្ឋានទិន្នន័យ',
    shortTitle: 'Database Systems',
    shortTitleKm: 'ប្រព័ន្ធមូលដ្ឋានទិន្នន័យ',
    icon: 'database',
    accent: 'violet',
    cardCount: 6,
    progress: 45,
    status: 'in_progress',
    sourceKind: 'youtube',
  },
  {
    id: 'kit-networks',
    title: 'Computer Networks',
    titleKm: 'បណ្តាញកុំព្យូទ័រ',
    icon: 'code',
    accent: 'amber',
    cardCount: 8,
    progress: 58,
    status: 'in_progress',
    sourceKind: 'pdf',
  },
  {
    id: 'kit-literacy',
    title: 'Digital Literacy',
    titleKm: 'អក្ខរកម្មឌីជីថល',
    icon: 'share',
    accent: 'teal',
    cardCount: 10,
    progress: 78,
    status: 'completed',
    sourceKind: 'link',
  },
];

export const kitFiles = [
  { id: 'f1', name: 'Database Week 1.pdf', kind: 'pdf', size: '2.4 MB', status: 'ready', pages: 18 },
  { id: 'f2', name: 'ER diagram reference.pdf', kind: 'pdf', size: '1.1 MB', status: 'ready', pages: 6 },
  { id: 'f3', name: 'Intro to Databases — full lecture', kind: 'youtube', size: '5h 02m', status: 'ready' },
  { id: 'f4', name: 'Week 2 notes.jpg', kind: 'image', size: '820 KB', status: 'processing' },
];

/** docs/screens/03-study-kits/03-study-kit-file-list. */
export const kitDetailFiles = [
  { id: 'd1', name: 'Database Week 1.pdf', kind: 'pdf', size: '2.4 MB' },
  { id: 'd2', name: 'Database Week 2.pdf', kind: 'pdf', size: '3.1 MB' },
  { id: 'd3', name: 'Normalization notes.jpg', kind: 'image', size: '1.8 MB' },
  { id: 'd4', name: 'Introduction to SQL', kind: 'youtube', size: '5h 02m' },
  { id: 'd5', name: 'ER diagrams and keys.pdf', kind: 'pdf', size: '890 KB' },
  { id: 'd6', name: 'Practice questions.docx', kind: 'document', size: '420 KB' },
];

/** docs/screens/04-study-mode-summaries/02 — 12 chapters, 5 ready. */
export const chapters = [
  { index: 1, title: 'Database foundations', titleKm: 'មូលដ្ឋានគ្រឹះនៃមូលដ្ឋានទិន្នន័យ', start: 0, end: 1458, status: 'ready' },
  { index: 2, title: 'Data models and schemas', titleKm: 'គំរូទិន្នន័យ និងគ្រោងការណ៍', start: 1458, end: 3522, status: 'ready' },
  { index: 3, title: 'Relational databases', titleKm: 'មូលដ្ឋានទិន្នន័យទំនាក់ទំនង', start: 3522, end: 6130, status: 'ready' },
  { index: 4, title: 'SQL fundamentals', titleKm: 'មូលដ្ឋានគ្រឹះនៃ SQL', start: 6130, end: 9365, status: 'ready' },
  { index: 5, title: 'Indexing and performance', titleKm: 'សន្ទស្សន៍ និងដំណើរការ', start: 9365, end: 12104, status: 'generating' },
  { index: 6, title: 'Normalization', titleKm: 'ការធ្វើឱ្យធម្មតា', start: 12104, end: 14200, status: 'pending' },
  { index: 7, title: 'Transactions', titleKm: 'ប្រតិបត្តិការ', start: 14200, end: 15600, status: 'pending' },
  { index: 8, title: 'Schema design', titleKm: 'ការរចនាគ្រោងការណ៍', start: 15600, end: 16400, status: 'pending' },
  { index: 9, title: 'Advanced queries', titleKm: 'សំណួរកម្រិតខ្ពស់', start: 16400, end: 17100, status: 'pending' },
  { index: 10, title: 'Security and permissions', titleKm: 'សុវត្ថិភាព និងសិទ្ធិ', start: 17100, end: 17600, status: 'pending' },
  { index: 11, title: 'Backup and recovery', titleKm: 'ការបម្រុងទុក និងការស្តារ', start: 17600, end: 17900, status: 'pending' },
  { index: 12, title: 'Putting it into practice', titleKm: 'ការអនុវត្តជាក់ស្តែង', start: 17900, end: 18120, status: 'pending' },
];

export const summary = {
  title: 'Course overview',
  titleKm: 'ទិដ្ឋភាពរួមនៃមេរៀន',
  bodyMd: [
    'A complete overview of the five-hour lecture, organized into chapters so you can learn at your own pace.',
  ].join('\n'),
  bodyMdKm: 'ទិដ្ឋភាពរួមពេញលេញនៃមេរៀន ៥ ម៉ោង ដែលបែងចែកជាជំពូក ដើម្បីឱ្យអ្នករៀនតាមល្បឿនរបស់អ្នក។',
  keyPoints: [
    'A database stores information in tables made of rows and columns',
    'A primary key uniquely identifies each record in a table',
    'Relationships connect two or more tables together',
  ],
  keyPointsKm: [
    'មូលដ្ឋានទិន្នន័យរក្សាទុកព័ត៌មានជាទម្រង់តារាង',
    'គន្លឹះចម្បងកំណត់អត្តសញ្ញាណកំណត់ត្រានីមួយៗដោយឯកឯង',
    'ទំនាក់ទំនងភ្ជាប់តារាងពីរឬច្រើនចូលគ្នា',
  ],
  durationLabel: '5h 02m',
  sourceLabel: 'YouTube',
};

export const quizQuestions = [
  {
    id: 'q1',
    prompt: 'What does a primary key do?',
    promptKm: 'តើគន្លឹះចម្បងមានតួនាទីអ្វី?',
    options: [
      'Uniquely identifies each record in a table',
      'Stores image data',
      'Deletes a table',
      'Creates a new user',
    ],
    optionsKm: [
      'កំណត់អត្តសញ្ញាណកំណត់ត្រានីមួយៗដោយឯកឯង',
      'រក្សាទុករូបភាព',
      'លុបតារាង',
      'បង្កើតអ្នកប្រើប្រាស់ថ្មី',
    ],
    correct: 0,
    explanation: 'A primary key guarantees every record has one unique, non-null identifying value.',
    explanationKm: 'គន្លឹះចម្បងធានាថាកំណត់ត្រានីមួយៗមានតម្លៃតែមួយគត់ មិនស្ទួន និងមិនទទេ។',
    topic: 'Primary keys',
  },
  {
    id: 'q2',
    prompt: 'What does SQL stand for?',
    promptKm: 'តើ SQL តំណាងឱ្យអ្វី?',
    options: ['Structured Query Language', 'Simple Question List', 'System Quality Log', 'Standard Queue Layer'],
    optionsKm: ['Structured Query Language', 'Simple Question List', 'System Quality Log', 'Standard Queue Layer'],
    correct: 0,
    explanation: 'SQL is Structured Query Language, used to work with relational databases.',
    explanationKm: 'SQL គឺជា Structured Query Language ដែលប្រើសម្រាប់ធ្វើការជាមួយមូលដ្ឋានទិន្នន័យទំនាក់ទំនង។',
    topic: 'SQL queries',
  },
  {
    id: 'q3',
    prompt: 'A table can have more than one primary key.',
    promptKm: 'តារាងមួយអាចមានគន្លឹះចម្បងច្រើនជាងមួយ។',
    options: ['True', 'False'],
    optionsKm: ['ពិត', 'មិនពិត'],
    correct: 1,
    explanation: 'A table has exactly one primary key, though it may be composed of several columns.',
    explanationKm: 'តារាងមួយមានគន្លឹះចម្បងតែមួយប៉ុណ្ណោះ ទោះបីជាវាអាចផ្សំពីជួរឈរច្រើនក៏ដោយ។',
    topic: 'Primary keys',
  },
];

export const quizResult = {
  correct: 9,
  total: 12,
  mastery: 75,
  takeaways: [
    'You understand database purpose',
    'Review relational concepts',
    'Practice SQL fundamentals next',
  ],
  takeawaysKm: [
    'អ្នកយល់ពីគោលបំណងនៃមូលដ្ឋានទិន្នន័យ',
    'ត្រូវពិនិត្យឡើងវិញនូវគំនិតទំនាក់ទំនង',
    'បន្តអនុវត្តមូលដ្ឋានគ្រឹះនៃ SQL',
  ],
};

export const practiceResult = {
  correct: 8,
  answered: 10,
  total: 10,
  mastery: 80,
  toReview: 2,
  weakTopics: ['SQL queries', 'Primary keys'],
  weakTopicsKm: ['សំណួរ SQL', 'គន្លឹះចម្បង'],
};

export const flashcards = [
  { id: 'c1', term: 'Relational database', termKm: 'មូលដ្ឋានទិន្នន័យទំនាក់ទំនង', definition: 'A database that stores information in tables that relate to one another', definitionKm: 'មូលដ្ឋានទិន្នន័យដែលរក្សាទុកព័ត៌មានជាតារាងដែលមានទំនាក់ទំនងគ្នា' },
  { id: 'c2', term: 'Primary key', termKm: 'គន្លឹះចម្បង', definition: 'A column whose value uniquely identifies each record', definitionKm: 'ជួរឈរដែលកំណត់អត្តសញ្ញាណកំណត់ត្រានីមួយៗដោយឯកឯង' },
  { id: 'c3', term: 'Foreign key', termKm: 'គន្លឹះបរទេស', definition: 'A column that points at the primary key of another table', definitionKm: 'ជួរឈរដែលចង្អុលទៅគន្លឹះចម្បងនៃតារាងមួយទៀត' },
  { id: 'c4', term: 'Index', termKm: 'សន្ទស្សន៍', definition: 'A structure that makes looking up rows faster', definitionKm: 'រចនាសម្ព័ន្ធដែលធ្វើឱ្យការស្វែងរកទិន្នន័យលឿនជាងមុន' },
  { id: 'c5', term: 'Normalization', termKm: 'ការធ្វើឱ្យធម្មតា', definition: 'Organising data to reduce duplication', definitionKm: 'ដំណើរការរៀបចំទិន្នន័យដើម្បីកាត់បន្ថយការស្ទួន' },
];

export const chatMessages = [
  { id: 'm1', role: 'assistant', content: 'Hi Sokchea! Ask me anything about your study kit.', contentKm: 'សួស្តី សុខជា! សួរខ្ញុំអំពីឯកសារសិក្សារបស់អ្នកបាន។', citations: [] },
  { id: 'm2', role: 'user', content: 'What is a primary key?', contentKm: 'តើគន្លឹះចម្បងជាអ្វី?', at: '9:42 AM' },
  {
    id: 'm3',
    role: 'assistant',
    content: 'A primary key uniquely identifies each record in a table.',
    contentKm: 'គន្លឹះចម្បងកំណត់អត្តសញ្ញាណកំណត់ត្រានីមួយៗក្នុងតារាងដោយឯកឯង។',
    citations: [{ sourceTitle: 'Database Week 1.pdf', pageNumber: 3 }],
    at: '9:42 AM',
  },
];

export const chatSuggestions = [
  { en: 'Explain SQL JOINs', km: 'ពន្យល់ពី SQL JOIN' },
  { en: 'Summarize Week 2', km: 'សង្ខេបសប្តាហ៍ទី ២' },
  { en: 'Give me an example', km: 'ផ្តល់ឧទាហរណ៍មួយ' },
];

export const classes = [
  {
    id: 'class-eng',
    title: 'English for Academic Success',
    titleKm: 'ភាសាអង់គ្លេសសម្រាប់ជោគជ័យសិក្សា',
    teacher: 'Prof. Chanthou',
    weeks: 12,
    lessonCount: 36,
    lessonsDone: 6,
    description: 'Build the reading, writing, vocabulary, and study skills needed for academic success.',
    descriptionKm: 'បង្កើតជំនាញអាន សរសេរ វាក្យសព្ទ និងជំនាញសិក្សាដែលត្រូវការសម្រាប់ជោគជ័យក្នុងការសិក្សា។',
  },
];

export const lessonsByWeek = [
  {
    week: 1,
    lessons: [
      { id: 'l1', title: 'Paragraph structure', titleKm: 'រចនាសម្ព័ន្ធកថាខណ្ឌ', kind: 'document', status: 'in_progress', done: 1, total: 3 },
      { id: 'l2', title: 'Finding the main idea', titleKm: 'ស្វែងរកគំនិតចម្បង', kind: 'reading', status: 'completed' },
      { id: 'l3', title: 'Academic reading basics', titleKm: 'មូលដ្ឋានការអានសិក្សា', kind: 'document', status: 'not_started' },
    ],
  },
  {
    week: 2,
    lessons: [
      { id: 'l4', title: 'Academic vocabulary', titleKm: 'វាក្យសព្ទសិក្សា', kind: 'reading', status: 'not_started' },
      { id: 'l5', title: 'Context clues', titleKm: 'តម្រុយបរិបទ', kind: 'document', status: 'not_started' },
      { id: 'l6', title: 'Word families', titleKm: 'គ្រួសារពាក្យ', kind: 'reading', status: 'not_started' },
    ],
  },
  {
    week: 3,
    lessons: [
      { id: 'l7', title: 'Cohesion and coherence', titleKm: 'ភាពស៊ីសង្វាក់គ្នា', kind: 'document', status: 'not_started' },
      { id: 'l8', title: 'Using transitions', titleKm: 'ការប្រើពាក្យផ្លាស់ប្តូរ', kind: 'reading', status: 'not_started' },
      { id: 'l9', title: 'Writing clear paragraphs', titleKm: 'សរសេរកថាខណ្ឌច្បាស់លាស់', kind: 'document', status: 'not_started' },
    ],
  },
];

export const assignment = {
  id: 'a1',
  title: 'ER Diagram Exercises',
  titleKm: 'លំហាត់ដ្យាក្រាម ER',
  className: 'English for Academic Success',
  dueLabel: 'Sep 14',
  overview: 'Practice identifying entities, attributes, relationships, and primary keys in an ER diagram.',
  overviewKm: 'អនុវត្តការកំណត់អង្គភាព លក្ខណៈ ទំនាក់ទំនង និងគន្លឹះចម្បងក្នុងដ្យាក្រាម ER។',
  instructions: [
    'Review the Week 1 materials',
    'Complete the ER diagram questions',
    'Submit your answers before the due date',
  ],
  instructionsKm: [
    'ពិនិត្យឯកសារសប្តាហ៍ទី ១',
    'បំពេញសំណួរដ្យាក្រាម ER',
    'ដាក់ស្នើចម្លើយមុនកាលបរិច្ឆេទកំណត់',
  ],
  materials: [
    { id: 'am1', name: 'Week 1 — Paragraph structure.pdf' },
    { id: 'am2', name: 'ER diagram reference.pdf' },
  ],
  questionCount: 10,
  completed: 0,
  status: 'not_started',
};

export const profileStats = [
  { key: 'kits', value: 4 },
  { key: 'cards', value: 36 },
  { key: 'streak', value: 5 },
];
