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
import "./OptionsPanel.scss";

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
    <div className="options-panel--wrapper" ref={wrapperRef}>
      <button
        type="button"
        className={`options-panel--trigger ${open ? "active" : ""}`}
        onClick={() => setOpen(!open)}
        title="Script options"
      >
        <EllipsisVerticalIcon size={16} />
      </button>
      {open && (
        <Panel className="options-panel--panel" minWidth="18rem">
          <PanelHeader icon={<Share2Icon size={12} />}>
            script options
          </PanelHeader>
          <PanelSection>
            <span className="options-panel--hint">
              Set a module name to share this script with other scripts.
            </span>
            <div className="options-panel--module-input-wrapper">
              <Input
                ref={moduleInputRef}
                className="options-panel--module-input"
                defaultValue={moduleName}
                placeholder="module-name"
                onChange={(event) => onModuleNameChange(event.target.value)}
              />
              <button
                type="button"
                className="options-panel--autofill-btn"
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
              className="options-panel--delete-btn"
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
