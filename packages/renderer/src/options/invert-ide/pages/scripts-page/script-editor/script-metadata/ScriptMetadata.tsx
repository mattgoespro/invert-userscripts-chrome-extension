import { Button } from "@/shared/components/button/Button";
import { sanitizeModuleName, Userscript } from "@shared/model";
import { PanelRightIcon } from "lucide-react";
import clsx from "clsx";
import { describeRunAt } from "../../../../shared/run-at";
import type { ScriptDetailsFocus } from "../script-details/ScriptDetailsPanel";
import type { ScriptMetadataActions } from "./useScriptMetadataActions";
import { isValidUrlPattern } from "./url-patterns";

const VISIBLE_PATTERN_CHIPS = 3;

type ScriptMetadataProps = {
  script: Userscript;
  actions: ScriptMetadataActions;
  detailsOpen: boolean;
  onOpenDetails: (focus: ScriptDetailsFocus) => void;
  onToggleDetails: () => void;
};

export function ScriptMetadata({
  script,
  actions,
  detailsOpen,
  onOpenDetails,
  onToggleDetails,
}: ScriptMetadataProps) {
  const patterns = script.urlPatterns ?? [];
  const hiddenCount = patterns.length - VISIBLE_PATTERN_CHIPS;

  return (
    <div className="flex w-full min-w-0 flex-col gap-sm">
      <div className="flex min-w-0 items-center gap-sm">
        <input
          className="h-8 min-w-0 flex-1 rounded-default border border-transparent bg-transparent px-1.5 font-heading text-[17px] font-bold tracking-[-0.01em] text-foreground outline-none hover:border-border focus:border-accent-border focus:bg-surface-input"
          required
          defaultValue={script.name}
          placeholder="Script name..."
          aria-label="Script name"
          onChange={(event) => {
            const newName = event.target.value;
            const updates: Partial<Userscript> = { name: newName };
            if (script.moduleName === sanitizeModuleName(script.name)) {
              const sanitized = sanitizeModuleName(newName);
              updates.moduleName = sanitized;
              updates.shared = sanitized.length > 0;
            }
            void actions.updateScript(updates);
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onOpenDetails("tester")}
        >
          Test a URL
        </Button>
        <Button
          variant="secondary"
          size="sm"
          aria-pressed={detailsOpen}
          onClick={onToggleDetails}
          title="Script details"
          className={clsx(detailsOpen && "border-selected bg-selected")}
        >
          <PanelRightIcon size={14} aria-hidden />
          Script details
        </Button>
      </div>
      <div className="flex min-w-0 items-center gap-sm px-1.5">
        <button
          type="button"
          data-testid="url-pattern-summary"
          onClick={() => onOpenDetails("patterns")}
          title="Edit where this script runs"
          className="flex min-w-0 cursor-pointer items-center gap-1.5 rounded-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {patterns.length === 0 ? (
            <span className="rounded-default border border-dashed border-warning px-2 py-0.5 text-xs text-warning">
              Add URL patterns
            </span>
          ) : (
            <>
              {patterns.slice(0, VISIBLE_PATTERN_CHIPS).map((pattern) => (
                <span
                  key={pattern}
                  className={clsx(
                    "max-w-60 truncate rounded-default px-2 py-0.5 font-mono text-xs",
                    isValidUrlPattern(pattern)
                      ? "bg-selected text-foreground"
                      : "bg-error-surface text-error-accent"
                  )}
                >
                  {pattern}
                </span>
              ))}
              {hiddenCount > 0 && (
                <span className="shrink-0 text-xs text-text-muted">
                  +{hiddenCount} more
                </span>
              )}
            </>
          )}
        </button>
        <span className="ml-auto shrink-0 text-xs text-text-muted-strong">
          {describeRunAt(script.runAt)}
        </span>
      </div>
    </div>
  );
}
