import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/global.css";
import "./styles/native.css";
import "./admin/styles/global.css";
import { applyPlatformAttribute } from "./platform.js";
import App from "./App.jsx";

applyPlatformAttribute();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
