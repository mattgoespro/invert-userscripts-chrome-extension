import { createRoot } from "react-dom/client";
import { InvertIde } from "./invert-ide/InvertIde";
import { Provider } from "react-redux";
import { store } from "@/shared/store/store";

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <InvertIde />
  </Provider>
);
