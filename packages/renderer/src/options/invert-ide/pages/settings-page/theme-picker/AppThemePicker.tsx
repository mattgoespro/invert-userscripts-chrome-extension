import { AppThemes, type AppThemeFamily } from "@shared/constants";
import type { AppThemeName } from "@shared/model";
import clsx from "clsx";

type AppThemePickerProps = {
  value: AppThemeName;
  onChange: (theme: AppThemeName) => void;
};

const FAMILIES: AppThemeFamily[] = ["Cyanotype", "Graphite", "Obsidian"];

/** Theme cards grouped by family; each card previews the theme's surfaces and signal. */
export function AppThemePicker({ value, onChange }: AppThemePickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="App theme"
      className="flex flex-col gap-md"
    >
      {FAMILIES.map((family) => (
        <div key={family} className="flex flex-col gap-sm">
          <p className="text-xs font-medium text-text-muted-strong">{family}</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-sm">
            {AppThemes.filter((theme) => theme.family === family).map(
              (theme) => {
                const selected = value === theme.name;
                const [base, raised, selection, accent] = theme.swatches;
                return (
                  <button
                    key={theme.name}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onChange(theme.name)}
                    className={clsx(
                      "flex cursor-pointer flex-col gap-2 rounded-default border p-2 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      selected
                        ? "border-accent bg-accent-subtle"
                        : "border-border hover:border-text-muted-faint"
                    )}
                  >
                    <span
                      aria-hidden
                      className="flex h-10 overflow-hidden rounded-[4px] border border-black/10"
                    >
                      <span className="flex-3" style={{ background: base }} />
                      <span className="flex-2" style={{ background: raised }} />
                      <span
                        className="flex-1"
                        style={{ background: selection }}
                      />
                      <span className="flex-1" style={{ background: accent }} />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-base font-semibold text-foreground">
                        {theme.displayName}
                      </span>
                      <span className="text-xs text-text-muted-strong">
                        {theme.description}
                      </span>
                    </span>
                  </button>
                );
              }
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
