
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { AppProvider } from './contexts/AppContext.tsx';

// Register Service Worker for PWA capabilities
if ('serviceWorker' in navigator) {
  const registerSW = () => {
    // Construct an absolute URL for the service worker to avoid cross-origin issues
    // in sandboxed environments where root-relative paths might be resolved incorrectly.
    const swUrl = `${window.location.origin}/sw.js`;
    navigator.serviceWorker.register(swUrl).then(registration => {
      console.log('Service Worker registered with scope:', registration.scope);
    }).catch(error => {
      console.error('Service Worker registration failed:', error);
    });
  };

  // If the document is already loaded, register the service worker immediately.
  // Otherwise, wait for the 'load' event. This is more robust than just
  // listening for 'load', as the event may have already fired.
  if (document.readyState === 'complete') {
    registerSW();
  } else {
    window.addEventListener('load', registerSW);
  }
}


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);