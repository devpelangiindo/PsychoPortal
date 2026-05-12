import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installApiFetch } from "./lib/api-base";

installApiFetch();
createRoot(document.getElementById("root")!).render(<App />);
