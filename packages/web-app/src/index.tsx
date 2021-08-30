import React from 'react';
import ReactDOM from 'react-dom';
import { Workbox } from 'workbox-window';
import { App } from './App';

if (import.meta.env.MODE === 'production' && 'serviceWorker' in navigator) {
  console.log('Starting service worker');

  const wb = new Workbox('/sw.js');

  wb.addEventListener('waiting', () => {
    if (window.confirm('New version available. Update?')) {
      wb.addEventListener('controlling', () => {
        window.location.reload();
      });

      wb.messageSkipWaiting();
    }
  });

  wb.register();
}

const renderApp = async () => {
  if (import.meta.env.MODE !== 'production') {
    const whyDidYouRender = await import(
      '@welldone-software/why-did-you-render'
    );
    whyDidYouRender.default(React);
  }

  ReactDOM.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    document.getElementById('root'),
  );
};

renderApp();

// Hot Module Replacement (HMR) - Remove this snippet to remove HMR.
// Learn more: https://snowpack.dev/concepts/hot-module-replacement
if (import.meta.hot) {
  import.meta.hot?.accept();
}
