import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CaptureApp from "./shots/CaptureApp";
import "./index.css";

const isShotCapture = new URLSearchParams(window.location.search).has("shot");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isShotCapture ? <CaptureApp /> : <App />}
  </React.StrictMode>
);
