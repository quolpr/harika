import React from 'react';
import { createRoot } from 'react-dom/client';
import { Workbox } from 'workbox-window';

import { App } from './App';

if (import.meta.env.MODE === 'production') {
  window.addEventListener('error', function (e) {
    alert(`Unhandled error happened "${e.message}" — please, restart the app.`);
  });
}

if (
  import.meta.env.MODE === 'production' &&
  import.meta.env.VITE_ENABLE_SW === 'true'
) {
  if ('serviceWorker' in navigator) {
    console.log('Starting service worker');

    const wb = new Workbox('/sw.js');

    wb.addEventListener('waiting', () => {
      if (window.confirm('New version available. Update?')) {
        wb.addEventListener('controlling', () => {
          window.location.reload();
        });

        wb.messageSkipWaiting();
        setInterval(() => {
          console.log('trying to skip waiting');
          wb.messageSkipWaiting();
        }, 500);
      }
    });

    wb.register();
  }
}

const renderApp = async () => {
  if (import.meta.env.MODE !== 'production') {
    const whyDidYouRender = await import(
      '@welldone-software/why-did-you-render'
    );
    whyDidYouRender.default(React as any);
  }

  const el = <App />;

  const container = document.getElementById('root');
  if (!container) {
    throw new Error('Root not found');
  }

  const root = createRoot(container);
  root.render(el);
};

renderApp();

// Hot Module Replacement (HMR) - Remove this snippet to remove HMR.
if (import.meta.hot) {
  import.meta.hot?.accept();
}
