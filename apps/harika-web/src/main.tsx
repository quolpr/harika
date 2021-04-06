import React from 'react';
import ReactDOM from 'react-dom';
import { App } from '@harika/harika-ui';

if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  // Use the window load event to keep the page load performant
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js');
  });
}

ReactDOM.render(<App />, document.getElementById('root'));
