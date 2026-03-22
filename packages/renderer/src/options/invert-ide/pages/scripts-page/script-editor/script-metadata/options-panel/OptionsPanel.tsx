import { Input } from "@/shared/components/input/Input";
import {
  Panel,
  PanelDivider,
  PanelHeader,
  PanelSection,
} from "@/shared/components/panel/Panel";
import {
  EllipsisVerticalIcon,
  Share2Icon,
  Trash2Icon,
  WandSparklesIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";

/**
 * Sanitizes a script name into a valid kebab-case module name.
 * Lowercases, replaces non-alphanumeric characters with hyphens, collapses
 * consecutive hyphens, and trims leading/trailing hyphens.
 */
function sanitizeModuleName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type OptionsPanelProps = {
  shared: boolean;
  scriptName: string;
  moduleName: string;
  onModuleNameChange: (value: string) => void;
  onDelete: () => void;
};

export function OptionsPanel({
  scriptName,
  moduleName,
  onModuleNameChange,
  onDelete,
}: OptionsPanelProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const moduleInputRef = useRef<HTMLInputElement>(null);

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    },
    [wrapperRef]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleClickOutside]);

  const handleDelete = () => {
    setOpen(false);
    onDelete();
  };

  const handleAutoFillModuleName = () => {
    const sanitized = sanitizeModuleName(scriptName);
    if (sanitized && moduleInputRef.current) {
      moduleInputRef.current.value = sanitized;
      onModuleNameChange(sanitized);
    }
  };

  return (
    <div className="relative shrink-0" ref={wrapperRef}>
      <button
        type="button"
        className={clsx(
          "flex items-center justify-center w-(--input-height) h-(--input-height) rounded-default cursor-pointer transition-colors duration-150",
          open
            ? "bg-accent-subtle border border-accent-border text-accent"
            : "bg-surface-input border border-border text-text-muted hover:border-text-muted hover:text-text-muted-strong hover:bg-hover-overlay",
          "focus-visible:outline-none focus-visible:border-accent-border"
        )}
        onClick={() => setOpen(!open)}
        title="Script options"
      >
        <EllipsisVerticalIcon size={16} />
      </button>
      {open && (
        <Panel minWidth="18rem">
          <PanelHeader icon={<Share2Icon size={12} />}>
            script options
          </PanelHeader>
          <PanelSection>
            <span className="font-body text-xs text-text-muted leading-[1.4]">
              Set a module name to share this script with other scripts.
            </span>
            <div className="relative w-full">
              <Input
                ref={moduleInputRef}
                className="w-full"
                defaultValue={moduleName}
                placeholder="module-name"
                onChange={(event) => onModuleNameChange(event.target.value)}
              />
              <button
                type="button"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-6.5 h-6.5 bg-transparent border border-transparent rounded-default cursor-pointer text-text-muted-faint transition-colors duration-150 hover:text-accent hover:bg-accent-subtle hover:border-accent-border active:-translate-y-1/2 active:scale-[0.92]"
                onClick={handleAutoFillModuleName}
                title="Auto-fill from script name"
              >
                <WandSparklesIcon size={13} />
              </button>
            </div>
          </PanelSection>
          <PanelDivider />
          <PanelSection>
            <button
              type="button"
              className="w-full justify-center text-xs py-2 px-3 gap-2 bg-error-surface text-error-accent border border-error-border rounded-default cursor-pointer font-mono font-medium flex items-center transition-colors duration-150 hover:bg-danger hover:border-danger hover:text-foreground active:scale-[0.98]"
              onClick={handleDelete}
            >
              <Trash2Icon size={13} />
              Delete script
            </button>
          </PanelSection>
        </Panel>
      )}
    </div>
  );
}
