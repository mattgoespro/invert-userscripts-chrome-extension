import { DevToolsItem } from "./devtools-item/DevToolsItem";
import { StoragePreview } from "./storage-preview/StoragePreview";
import { ThemeSwitcher, ThemeSwitcherIcon, useActiveTheme } from "./theme-switcher/ThemeSwitcher";
import "./DevTools.scss";

export function DevTools() {
  const { activeOption } = useActiveTheme();

  return (
    <div className="app-dev-tools">
      <DevToolsItem
        name={activeOption.label}
        icon={<ThemeSwitcherIcon accent={activeOption.accent} />}
        panel={<ThemeSwitcher />}
        panelTitle="devtools: theme"
      />
      <DevToolsItem
        name="chrome.storage.sync"
        panel={<StoragePreview />}
        panelTitle="devtools: storage inspector"
      />
    </div>
  );
}
