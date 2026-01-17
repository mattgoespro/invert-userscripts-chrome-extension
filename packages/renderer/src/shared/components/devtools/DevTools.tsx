import { createDevTools } from "@redux-devtools/core";
import { DockMonitor } from "@redux-devtools/dock-monitor";
import { InspectorMonitor } from "@redux-devtools/inspector-monitor";

export const ReduxDevToolsPanel = createDevTools(
  <DockMonitor
    defaultPosition="right"
    changeMonitorKey="ctrl-b"
    toggleVisibilityKey="ctrl-h"
    changePositionKey="ctrl-q"
    defaultIsVisible={true}
    fluid
  >
    <InspectorMonitor theme="inspector" />
  </DockMonitor>
);
