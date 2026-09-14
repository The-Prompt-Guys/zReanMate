import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import './index.css';
import { I18nProvider } from './i18n/index.js';
import { AuthProvider } from './auth/AuthContext.jsx';
import { router } from './routes/router.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
);
