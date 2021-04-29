import React from 'react';
import ReactDOM from 'react-dom';
import { App } from '@harika/harika-ui';
import { environment } from './environments/environment';

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
