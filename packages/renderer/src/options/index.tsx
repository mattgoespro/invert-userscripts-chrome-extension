import { ReduxDevToolsPanel } from "@/shared/components/devtools/DevTools";
import { ErrorBoundary } from "@/shared/components/error-boundary/ErrorBoundary";
import { store } from "@/shared/store/store";
import { createRoot } from "react-dom/client";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";
import { Provider } from "react-redux";
import { InvertIde } from "./invert-ide/InvertIde";

createRoot(document.getElementById("root")).render(
  <ReactErrorBoundary FallbackComponent={ErrorBoundary}>
    <Provider store={store}>
      <InvertIde />
      <ReduxDevToolsPanel store={store} />
    </Provider>
  </ReactErrorBoundary>
);
