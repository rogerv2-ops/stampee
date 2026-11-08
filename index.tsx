import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from './lib/i18n';
import { LanguageSelector } from './components/LanguageSelector';
import './index.css';

// Ensure no stale service worker is serving cached assets.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  }).catch(() => {
    // No-op: failure to unregister should not break app startup.
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <I18nProvider>
      <App />
      <LanguageSelector />
    </I18nProvider>
  </React.StrictMode>
);
