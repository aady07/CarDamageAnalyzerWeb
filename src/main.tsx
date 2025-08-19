import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Polyfill global and Buffer for amazon-cognito-identity-js in browser
// @ts-ignore
if (typeof global === 'undefined') {
  // @ts-ignore
  (window as any).global = window;
}
// Provide Buffer if missing
// @ts-ignore
if (typeof (window as any).Buffer === 'undefined') {
  import('buffer').then(({ Buffer }) => {
    // @ts-ignore
    (window as any).Buffer = Buffer;
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
