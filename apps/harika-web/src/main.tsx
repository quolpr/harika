import React from 'react';
import ReactDOM from 'react-dom';
import { App } from '@harika/harika-ui';
import { environment } from './environments/environment';
import * as Sentry from '@sentry/react';
import { Integrations } from '@sentry/tracing';

Sentry.init({
  dsn:
    'https://6ce6cfabdd2b45aa8d6b402a10e261b1@o662294.ingest.sentry.io/5765293',
  integrations: [new Integrations.BrowserTracing()],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});

if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  // Use the window load event to keep the page load performant
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/serviceWorker.js');
  });
}

ReactDOM.render(
  <App environment={environment} />,
  document.getElementById('root')
);
