import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Studio } from "./components/Studio";
import { LocaleProvider } from "./i18n/locale";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing root");

createRoot(root).render(
  <StrictMode>
    <LocaleProvider>
      <Studio />
    </LocaleProvider>
  </StrictMode>,
);
