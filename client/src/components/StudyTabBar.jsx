import { NavLink } from 'react-router-dom';

import { useT } from '../i18n/index.js';

/**
 * The contextual bar on the quiz and flashcard screens — Practice / Learn /
 * Flashcards / More, not the app's Home / Kits / Classes / Practice / Profile.
 * docs/screens/06-quiz/01 and 08-flashcards/01 both use this one.
 */
export const StudyTabBar = ({ kitId = 'kit-database', active = 'practice' }) => {
  const t = useT();

  const tabs = [
    { id: 'practice', to: '/practice', labelKey: 'nav.practice', Icon: BookIcon },
    { id: 'learn', to: `/study/${kitId}/summary`, labelKey: 'nav.learn', Icon: TargetIcon },
    { id: 'flashcards', to: `/flashcards/${kitId}`, labelKey: 'nav.flashcards', Icon: CardsIcon },
    { id: 'more', to: `/kits/${kitId}`, labelKey: 'nav.more', Icon: DocIcon },
  ];

  return (
    <nav className="sticky bottom-0 border-t border-tint-200 bg-white/95 backdrop-blur">
      <ul className="flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ id, to, labelKey, Icon }) => {
          const isActive = id === active;
          return (
            <li key={id} className="flex-1">
              <NavLink
                to={to}
                className={`flex flex-col items-center gap-1 py-2.5 text-xs font-semibold ${
                  isActive ? 'text-navy-800' : 'text-navy-600/55'
                }`}
              >
                <Icon filled={isActive} />
                <span>{t(labelKey)}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

const stroke = {
  viewBox: '0 0 24 24',
  className: 'size-6',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
};

const BookIcon = ({ filled }) => (
  <svg {...stroke} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 7c-2-1.6-4.4-2-7-2v12c2.6 0 5 .4 7 2 2-1.6 4.4-2 7-2V5c-2.6 0-5 .4-7 2z" />
    <path d="M12 7v12" fill="none" stroke="currentColor" />
  </svg>
);

const TargetIcon = ({ filled }) => (
  <svg {...stroke} fill="none">
    <circle cx="12" cy="12" r="8" fill={filled ? 'currentColor' : 'none'} />
    <circle cx="12" cy="12" r="3.4" stroke={filled ? '#fff' : 'currentColor'} />
    <path d="m15 9 5-5m0 0h-3.5M20 4v3.5" />
  </svg>
);

const CardsIcon = ({ filled }) => (
  <svg {...stroke} fill={filled ? 'currentColor' : 'none'}>
    <rect x="3" y="7" width="13" height="13" rx="2.5" />
    <path d="M8 4h10a2 2 0 0 1 2 2v10" fill="none" stroke="currentColor" />
  </svg>
);

const DocIcon = ({ filled }) => (
  <svg {...stroke} fill={filled ? 'currentColor' : 'none'}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" fill="none" stroke={filled ? '#fff' : 'currentColor'} />
  </svg>
);
