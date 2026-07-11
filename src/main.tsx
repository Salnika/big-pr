import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { AppProviders } from "./app/AppProviders";
import "./app/global.css.ts";

const container = document.querySelector("#app");

if (!container) {
  throw new Error("Application root element was not found.");
}

ReactDOM.createRoot(container).render(
  <AppProviders>
    <App />
  </AppProviders>,
);
