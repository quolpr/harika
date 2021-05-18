import React from 'react';
import ReactDOM from 'react-dom';
import { App } from './App';

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
  import.meta.hot.accept();
}
