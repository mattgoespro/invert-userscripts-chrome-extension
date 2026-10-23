import { Button } from "@/shared/components/button/Button";
import { RuntimeCapabilityNotice } from "@/shared/components/runtime-capability/RuntimeCapabilityNotice";
import { ScriptList } from "@/shared/components/script-list/ScriptList";
import { Typography } from "@/shared/components/typography/Typography";
import { selectAllUserscripts } from "@/shared/store/slices/userscripts/selectors";
import { loadUserscripts } from "@/shared/store/slices/userscripts/thunks.load";
import { applyAppTheme } from "@/shared/utils/app-theme";
import { matchesUrlPattern } from "@shared/url-matching";
import { isInjectablePage } from "@shared/injection-eligibility";
import { ChromeSyncStorage } from "@shared/storage";
import { NEW_SCRIPT_PATTERN_PARAM } from "@shared/constants";
import { ExternalLinkIcon, PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { PopupDispatch, PopupRootState } from "./popup-store";

/** A pattern covering the whole site of an http(s) page, e.g. https://github.com/*. */
function getSitePattern(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return `${parsed.protocol}//${parsed.hostname}/*`;
  } catch {
    return null;
  }
}

function getDisplayAddress(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

export function Popup() {
  const dispatch = useDispatch<PopupDispatch>();
  const scripts = useSelector((state: PopupRootState) =>
    selectAllUserscripts(state)
  );
  const [activeTabUrl, setActiveTabUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      const [settings] = await Promise.all([
        ChromeSyncStorage.getEditorSettings().catch((): undefined => undefined),
        dispatch(loadUserscripts()),
      ]);
      applyAppTheme(settings?.appTheme);

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tab?.url) {
        setActiveTabUrl(tab.url);
      }

      setIsLoading(false);
    };

    initialize();
  }, [dispatch]);

  const canRunHere = !!activeTabUrl && isInjectablePage(activeTabUrl);

  const { running, turnedOff } = useMemo(() => {
    if (!activeTabUrl || !canRunHere) {
      return { running: [], turnedOff: [] };
    }

    const matching = Object.values(scripts).filter((script) =>
      matchesUrlPattern(activeTabUrl, script.urlPatterns)
    );
    return {
      running: matching.filter((script) => script.enabled),
      turnedOff: matching.filter((script) => !script.enabled),
    };
  }, [scripts, activeTabUrl, canRunHere]);

  const matchingCount = running.length + turnedOff.length;
  const sitePattern = activeTabUrl ? getSitePattern(activeTabUrl) : null;
  const siteHost = sitePattern ? new URL(activeTabUrl).hostname : null;

  const onOpenIde = () => {
    chrome.runtime.openOptionsPage();
  };

  const onCreateForSite = () => {
    if (!sitePattern) {
      return;
    }
    const url = new URL(chrome.runtime.getURL("options.html"));
    url.searchParams.set(NEW_SCRIPT_PATTERN_PARAM, sitePattern);
    void chrome.tabs.create({ url: url.toString() });
    window.close();
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-base">
        <Typography variant="body">Loading...</Typography>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-surface-base">
      <RuntimeCapabilityNotice />
      <div className="flex items-center justify-between gap-sm border-b border-border bg-surface-chrome px-md py-sm">
        <div className="flex min-w-0 flex-col">
          <span className="font-heading text-[17px] leading-tight font-extrabold tracking-[-0.04em] text-foreground">
            Invert
          </span>
          {activeTabUrl && (
            <span
              className="truncate font-mono text-[11px] text-text-muted-strong"
              title={activeTabUrl}
            >
              {getDisplayAddress(activeTabUrl)}
            </span>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onOpenIde}
          title="Open IDE"
        >
          <ExternalLinkIcon size={13} aria-hidden />
          Open IDE
        </Button>
      </div>

      {matchingCount > 0 ? (
        <>
          <ScriptList
            groups={[
              ...(running.length > 0
                ? [{ site: "Running on this page", scripts: running }]
                : []),
              ...(turnedOff.length > 0
                ? [{ site: "Matches, but turned off", scripts: turnedOff }]
                : []),
            ]}
          />
          <div className="border-t border-border px-md py-1.5">
            <Typography variant="caption" className="text-text-muted-strong">
              {matchingCount} script{matchingCount !== 1 ? "s" : ""} matching
            </Typography>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center p-lg text-center">
          <Typography variant="body">
            {canRunHere
              ? "No scripts match this page"
              : "Scripts cannot run on this page"}
          </Typography>
        </div>
      )}

      {sitePattern && siteHost && (
        <div className="border-t border-border bg-surface-chrome p-sm">
          <Button fullWidth onClick={onCreateForSite}>
            <PlusIcon size={14} aria-hidden />
            New script for {siteHost}
          </Button>
        </div>
      )}
    </div>
  );
}
