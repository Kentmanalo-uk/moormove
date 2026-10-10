import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth';
import { ToastProvider } from './components/ui';
import App from './App';
import './styles/base.css';
import './styles/shell.css';
import './styles/maps.css';
import './styles/pages.css';
import './styles/phone.css';
import './styles/motion.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
