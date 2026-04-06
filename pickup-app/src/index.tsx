import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initOneSignal } from "./lib/onesignal";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  });
}

// Init OneSignal after page loads
window.addEventListener("load", () => {
  initOneSignal();
});
