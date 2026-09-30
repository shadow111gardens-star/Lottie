import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import './lib/firebase';
import App from "./App";
import { installProjectTracking } from './projects/store';

// Track dashboard metadata for the editor's existing saves, without changing it.
const removeProjectTracking = installProjectTracking();
if (import.meta.hot) import.meta.hot.dispose(removeProjectTracking);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
