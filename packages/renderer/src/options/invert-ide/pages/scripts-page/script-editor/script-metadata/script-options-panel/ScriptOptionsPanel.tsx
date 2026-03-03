import { useRef, useState, useEffect, useCallback } from "react";
import { EllipsisVerticalIcon, Share2Icon, Trash2Icon, WandSparklesIcon } from "lucide-react";
import { Input } from "@/shared/components/input/Input";
import "./ScriptOptionsPanel.scss";

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

type ScriptOptionsPanelProps = {
  shared: boolean;
  scriptName: string;
  moduleName: string;
  onModuleNameChange: (value: string) => void;
  onDelete: () => void;
};

export function ScriptOptionsPanel({
  scriptName,
  moduleName,
  onModuleNameChange,
  onDelete,
}: ScriptOptionsPanelProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const moduleInputRef = useRef<HTMLInputElement>(null);

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
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
    <div className="script-options--wrapper" ref={wrapperRef}>
      <button
        type="button"
        className={`script-options--trigger ${open ? "active" : ""}`}
        onClick={() => setOpen(!open)}
        title="Script options"
      >
        <EllipsisVerticalIcon size={16} />
      </button>
      {open && (
        <div className="script-options--panel">
          <div className="script-options--section">
            <div className="script-options--section-header">
              <Share2Icon size={12} className="script-options--section-icon" />
              <span className="script-options--section-title">script options</span>
            </div>
            <div className="script-options--section-body">
              <span className="script-options--hint">
                Set a module name to share this script with other scripts.
              </span>
              <div className="script-options--module-input-wrapper">
                <Input
                  ref={moduleInputRef}
                  className="script-options--module-input"
                  defaultValue={moduleName}
                  placeholder="module-name"
                  onChange={(e) => onModuleNameChange(e.target.value)}
                />
                <button
                  type="button"
                  className="script-options--autofill-btn"
                  onClick={handleAutoFillModuleName}
                  title="Auto-fill from script name"
                >
                  <WandSparklesIcon size={13} />
                </button>
              </div>
            </div>
          </div>
          <div className="script-options--divider" />
          <div className="script-options--section">
            <div className="script-options--section-body">
              <button type="button" className="script-options--delete-btn" onClick={handleDelete}>
                <Trash2Icon size={13} />
                Delete script
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
