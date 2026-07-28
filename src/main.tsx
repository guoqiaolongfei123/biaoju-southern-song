import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/ma-shan-zheng/chinese-simplified-400.css";
import "@fontsource/zcool-xiaowei/chinese-simplified-400.css";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
