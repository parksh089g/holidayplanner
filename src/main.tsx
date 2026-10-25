import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { requestPersistentStorage } from './db/persist';
import { warmHolidayCacheOnControl } from './lib/pwa';
import './index.css';

void requestPersistentStorage();
warmHolidayCacheOnControl();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
