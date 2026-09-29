import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initTheme } from "./design/components";
import "./design/tokens.css";

initTheme(); // the kept light or dark choice, before the first paint
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
