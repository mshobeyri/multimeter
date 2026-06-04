import { createRoot } from "react-dom/client";
import App from "./App";

document.addEventListener("contextmenu", event => {
  event.preventDefault();
}, true);

createRoot(document.getElementById("root")!).render(<App />);
