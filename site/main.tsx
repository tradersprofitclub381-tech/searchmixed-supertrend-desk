import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DeskApp } from "@/components/desk/desk-app";
import { startDesk } from "@/lib/deriv-engine";
import "@/styles.css";

startDesk();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  });
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <DeskApp />
    </StrictMode>,
  );
}
