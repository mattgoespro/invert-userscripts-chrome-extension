import { createDevTools } from "@redux-devtools/core";
import { DockMonitor } from "@redux-devtools/dock-monitor";
import { InspectorMonitor } from "@redux-devtools/inspector-monitor";

export const ReduxDevToolsPanel = createDevTools(
  <DockMonitor
    defaultPosition="right"
    toggleVisibilityKey="ctrl-h"
    changePositionKey="ctrl-q"
    defaultIsVisible={true}
    fluid
  >
    <InspectorMonitor theme="google" />
  </DockMonitor>
);
