import { Button } from "@/shared/components/button/Button";
import { Checkbox } from "@/shared/components/checkbox/Checkbox";
import { IconButton } from "@/shared/components/icon-button/IconButton";
import { useAppSelector } from "@/shared/store/hooks";
import { getDraftOrSavedSource } from "@/shared/store/slices/editor-drafts";
import { selectEnabledModules } from "@/shared/store/slices/modules";
import { selectSharedUserscripts } from "@/shared/store/slices/userscripts";
import {
  getScriptModulePath,
  sanitizeModuleName,
  Userscript,
} from "@shared/model";
import { getSharedImportModuleNames } from "@shared/shared-module-imports";
import { matchesUrlPattern } from "@shared/url-matching";
import { Trash2Icon, WandSparklesIcon, XIcon } from "lucide-react";
import clsx from "clsx";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { RUN_AT_OPTIONS } from "../../../../shared/run-at";
import type { ScriptMetadataActions } from "../script-metadata/useScriptMetadataActions";
import {
  isValidUrlPattern,
  parseUrlPatternInput,
} from "../script-metadata/url-patterns";

export type ScriptDetailsFocus = "patterns" | "tester";

type ScriptDetailsPanelProps = {
  script: Userscript;
  actions: ScriptMetadataActions;
  focus: { target: ScriptDetailsFocus; nonce: number } | null;
  onClose: () => void;
};

function DetailsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-sm border-b border-border-subtle px-lg py-md"
    >
      <div className="flex flex-col gap-0.5">
        <h3 id={headingId} className="text-xs font-semibold text-foreground">
          {title}
        </h3>
        {description && (
          <p className="text-xs leading-[1.45] text-text-muted-strong">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

export function ScriptDetailsPanel({
  script,
  actions,
  focus,
  onClose,
}: ScriptDetailsPanelProps) {
  const patterns = useMemo(
    () => script.urlPatterns ?? [],
    [script.urlPatterns]
  );
  const globalModules = useAppSelector(selectEnabledModules);
  const sharedScripts = useAppSelector(selectSharedUserscripts);
  const draftTypescript = useAppSelector(
    (state) => getDraftOrSavedSource(state, script.id).typescript
  );
  const [patternInput, setPatternInput] = useState("");
  const [patternError, setPatternError] = useState<string | null>(null);
  const [testUrl, setTestUrl] = useState("");
  const [openTabMatches, setOpenTabMatches] = useState<string[] | null>(null);
  const [tabsError, setTabsError] = useState<string | null>(null);
  const patternInputRef = useRef<HTMLInputElement>(null);
  const testerInputRef = useRef<HTMLInputElement>(null);
  const moduleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focus) {
      return;
    }
    const target =
      focus.target === "tester"
        ? testerInputRef.current
        : patternInputRef.current;
    target?.focus();
  }, [focus]);

  const invalidPatterns = useMemo(
    () => new Set(patterns.filter((pattern) => !isValidUrlPattern(pattern))),
    [patterns]
  );

  // Derive live import deps from draft/saved TypeScript — not the persisted
  // sharedScripts cache (that only updates on save for the service worker).
  const currentSharedDependencies = useMemo(() => {
    const importedPaths = new Set(getSharedImportModuleNames(draftTypescript));

    return sharedScripts.filter((sharedScript) =>
      importedPaths.has(getScriptModulePath(sharedScript))
    );
  }, [draftTypescript, sharedScripts]);

  const testResult = useMemo(() => {
    const url = testUrl.trim();
    if (!url) {
      return null;
    }
    const matchedPattern = patterns.find((pattern) =>
      matchesUrlPattern(url, [pattern])
    );
    return { matchedPattern };
  }, [testUrl, patterns]);

  const commitPatterns = () => {
    const candidates = parseUrlPatternInput(patternInput);
    if (candidates.length === 0) {
      return;
    }

    if (candidates.some((pattern) => !isValidUrlPattern(pattern))) {
      setPatternError(
        "Patterns start with http://, https:// or *://, like https://*.example.com/*"
      );
      return;
    }

    const toAdd = candidates.filter(
      (pattern, index) =>
        !patterns.includes(pattern) && candidates.indexOf(pattern) === index
    );
    if (toAdd.length > 0) {
      void actions.updateScript({ urlPatterns: [...patterns, ...toAdd] });
    }
    setPatternInput("");
    setPatternError(null);
  };

  const removePattern = (pattern: string) => {
    void actions.updateScript({
      urlPatterns: patterns.filter((existing) => existing !== pattern),
    });
  };

  const checkOpenTabs = async () => {
    try {
      setTabsError(null);
      const tabs = await chrome.tabs.query({});
      setOpenTabMatches(
        tabs
          .map((tab) => tab.url)
          .filter(
            (url): url is string => !!url && matchesUrlPattern(url, patterns)
          )
      );
    } catch (error) {
      console.error("Failed to query tabs:", error);
      setTabsError("Couldn’t read your open tabs.");
      setOpenTabMatches(null);
    }
  };

  const autoFillModuleName = () => {
    const sanitized = sanitizeModuleName(script.name);
    if (sanitized && moduleInputRef.current) {
      moduleInputRef.current.value = sanitized;
      actions.updateModuleName(sanitized);
    }
  };

  const runAt = script.runAt ?? "beforePageLoad";

  return (
    <aside
      aria-label="Script details"
      className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-surface-raised"
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-lg">
        <h2 className="text-sm font-semibold text-foreground">
          Script details
        </h2>
        <IconButton
          icon={XIcon}
          variant="ghost"
          size="sm"
          onClick={onClose}
          title="Close details panel"
        />
      </div>
      <div className="scrollbar-thin-6 min-h-0 flex-1 overflow-y-auto">
        <DetailsSection
          title="Where it runs"
          description="The script runs on pages that match any of these patterns."
        >
          {patterns.length === 0 && (
            <p className="text-xs text-warning">
              No patterns yet, so this script won’t run anywhere.
            </p>
          )}
          <ul className="flex flex-col gap-1" data-testid="url-pattern-list">
            {patterns.map((pattern) => {
              const invalid = invalidPatterns.has(pattern);
              return (
                <li
                  key={pattern}
                  className={clsx(
                    "group flex items-center gap-2 rounded-default border px-2.5 py-1",
                    invalid
                      ? "border-error-border bg-error-surface"
                      : "border-transparent bg-surface-input"
                  )}
                >
                  <span
                    className={clsx(
                      "min-w-0 flex-1 truncate font-mono text-xs",
                      invalid ? "text-error-accent" : "text-foreground"
                    )}
                    title={pattern}
                  >
                    {pattern}
                  </span>
                  {invalid && (
                    <span className="shrink-0 text-[11px] text-error-accent">
                      Invalid
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removePattern(pattern)}
                    className="shrink-0 cursor-pointer rounded-sm text-[11px] text-text-muted-strong hover:text-danger focus-visible:outline-2 focus-visible:outline-accent"
                    aria-label={`Remove ${pattern}`}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
          <input
            ref={patternInputRef}
            type="text"
            value={patternInput}
            onChange={(event) => {
              setPatternInput(event.target.value);
              setPatternError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                commitPatterns();
              }
            }}
            onBlur={() => {
              if (patternInput.trim()) {
                commitPatterns();
              }
            }}
            placeholder="Add a pattern, then press Enter"
            aria-label="Add URL pattern"
            aria-invalid={!!patternError}
            className={clsx(
              "h-8 w-full rounded-default border border-dashed bg-transparent px-2.5 font-mono text-xs text-foreground outline-none placeholder:font-body placeholder:text-text-muted-faint focus:border-solid focus:border-accent-border",
              patternError ? "border-danger" : "border-border"
            )}
          />
          {patternError && (
            <p role="alert" className="text-xs text-error-accent">
              {patternError}
            </p>
          )}
        </DetailsSection>

        <DetailsSection title="Try a URL">
          <input
            ref={testerInputRef}
            type="url"
            value={testUrl}
            onChange={(event) => setTestUrl(event.target.value)}
            placeholder="https://example.com/page"
            aria-label="URL to test"
            className="h-8 w-full rounded-default border border-border bg-surface-input px-2.5 font-mono text-xs text-foreground outline-none placeholder:text-text-muted-faint focus:border-accent-border"
          />
          <p
            role="status"
            className={clsx(
              "text-xs leading-[1.45]",
              !testResult && "text-text-muted-strong",
              testResult?.matchedPattern && "text-success",
              testResult && !testResult.matchedPattern && "text-text-muted"
            )}
          >
            {!testResult
              ? "Paste a page address to check whether this script runs there."
              : testResult.matchedPattern
                ? `Runs here. Matches ${testResult.matchedPattern}`
                : "Doesn’t run here. No pattern matches this URL."}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void checkOpenTabs()}
          >
            Check open tabs
          </Button>
          {tabsError && (
            <p className="text-xs text-error-accent">{tabsError}</p>
          )}
          {openTabMatches && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-text-muted">
                {openTabMatches.length === 0
                  ? "None of your open tabs match."
                  : `Runs in ${openTabMatches.length} open tab${openTabMatches.length === 1 ? "" : "s"}:`}
              </p>
              {openTabMatches.slice(0, 8).map((url, index) => (
                <p
                  key={`${url}-${index}`}
                  className="truncate font-mono text-[11px] text-text-muted-strong"
                  title={url}
                >
                  {url}
                </p>
              ))}
            </div>
          )}
        </DetailsSection>

        <DetailsSection title="When it runs">
          <div
            role="radiogroup"
            aria-label="When it runs"
            data-testid="run-at-select"
            className="flex rounded-default bg-surface-input p-0.5"
          >
            {RUN_AT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={runAt === option.value}
                title={option.hint}
                onClick={() =>
                  void actions.updateScript({ runAt: option.value })
                }
                className={clsx(
                  "h-7 flex-1 cursor-pointer rounded-[calc(var(--geometry-border-radius)-2px)] text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent",
                  runAt === option.value
                    ? "bg-selected text-foreground"
                    : "text-text-muted hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-text-muted-strong">
            {RUN_AT_OPTIONS.find((option) => option.value === runAt)?.hint}
          </p>
        </DetailsSection>

        <DetailsSection
          title="Modules"
          description="CDN libraries loaded before this script runs."
        >
          {globalModules.length > 0 ? (
            <div className="flex flex-col gap-sm">
              {globalModules.map((module) => (
                <Checkbox
                  key={module.id}
                  label={module.name}
                  checked={(script.globalModules ?? []).includes(module.id)}
                  onChange={(checked) =>
                    actions.toggleModule(module.id, checked)
                  }
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">
              No modules yet. Add them on the Modules page.
            </p>
          )}
        </DetailsSection>

        <DetailsSection
          title="Share as a module"
          description="Give this script a module name so other scripts can import it."
        >
          <div className="relative w-full">
            <input
              ref={moduleInputRef}
              defaultValue={script.moduleName ?? ""}
              placeholder="module-name"
              aria-label="Module name"
              onChange={(event) => actions.updateModuleName(event.target.value)}
              className="h-8 w-full rounded-default border border-border bg-surface-input pr-9 pl-2.5 font-mono text-xs text-foreground outline-none placeholder:text-text-muted-faint focus:border-accent-border"
            />
            <IconButton
              icon={WandSparklesIcon}
              variant="ghost"
              size="sm"
              className="absolute top-1/2 right-1 -translate-y-1/2"
              onClick={autoFillModuleName}
              title="Auto-fill from script name"
            />
          </div>
          {script.moduleName && (
            <p className="font-mono text-[11px] text-text-muted-strong">
              import … from &quot;scripts/{script.moduleName}/main&quot;
            </p>
          )}
        </DetailsSection>

        <DetailsSection
          title="Shared imports"
          description="Other scripts this one imports, read from its import statements."
        >
          {currentSharedDependencies.length > 0 ? (
            <div className="flex flex-col gap-1">
              {currentSharedDependencies.map((shared) => (
                <div
                  key={shared.id}
                  className="flex items-center justify-between gap-sm rounded-default bg-surface-input px-2.5 py-1 text-xs"
                >
                  <span className="truncate text-foreground">
                    {shared.name}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-text-muted-strong">
                    scripts/{shared.moduleName}/main
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">
              This script doesn’t import any shared scripts.
            </p>
          )}
        </DetailsSection>

        <div className="px-lg py-md">
          <Button variant="danger" size="sm" onClick={actions.deleteScript}>
            <Trash2Icon size={13} aria-hidden />
            Delete script
          </Button>
        </div>
      </div>
    </aside>
  );
}
