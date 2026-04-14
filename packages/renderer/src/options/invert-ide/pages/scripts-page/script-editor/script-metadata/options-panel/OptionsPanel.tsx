import { Button } from "@/shared/components/button/Button";
import { Checkbox } from "@/shared/components/checkbox/Checkbox";
import { IconButton } from "@/shared/components/icon-button/IconButton";
import { Input } from "@/shared/components/input/Input";
import {
  Panel,
  PanelDivider,
  PanelHeader,
  PanelSection,
} from "@/shared/components/panel/Panel";
import { GlobalModule } from "@shared/model";
import { ChromeSyncStorage } from "@shared/storage";
import {
  EllipsisVerticalIcon,
  PackageIcon,
  Share2Icon,
  Trash2Icon,
  WandSparklesIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cva } from "class-variance-authority";

const optionsTriggerVariants = cva(
  "flex items-center justify-center w-(--input-height) h-(--input-height) rounded-default cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:border-accent-border",
  {
    variants: {
      open: {
        true: "bg-accent-subtle border border-accent-border text-accent",
        false:
          "bg-surface-input border border-border text-text-muted hover:border-text-muted hover:text-text-muted-strong hover:bg-hover-overlay",
      },
    },
    defaultVariants: {
      open: false,
    },
  }
);

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
  selectedModuleIds: string[];
  onModuleNameChange: (value: string) => void;
  onToggleModule: (moduleId: string, selected: boolean) => void;
  onDelete: () => void;
};

export function OptionsPanel({
  scriptName,
  moduleName,
  selectedModuleIds,
  onModuleNameChange,
  onToggleModule,
  onDelete,
}: OptionsPanelProps) {
  const [open, setOpen] = useState(false);
  const [globalModules, setGlobalModules] = useState<GlobalModule[]>([]);
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
      ChromeSyncStorage.getAllModules().then((modules) => {
        setGlobalModules(Object.values(modules).filter((m) => m.enabled));
      });
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
        className={optionsTriggerVariants({ open })}
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
            <span className="font-body text-xs leading-[1.4] text-text-muted">
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
              <IconButton
                icon={WandSparklesIcon}
                variant="ghost"
                size="sm"
                className="absolute top-1/2 right-1.5 -translate-y-1/2 text-text-muted-faint hover:border-accent-border hover:bg-accent-subtle hover:text-accent active:scale-[0.92]"
                onClick={handleAutoFillModuleName}
                title="Auto-fill from script name"
              />
            </div>
          </PanelSection>
          <PanelDivider />
          <PanelHeader icon={<PackageIcon size={12} />}>
            CDN Modules
          </PanelHeader>
          <PanelSection>
            {globalModules.length > 0 ? (
              <div className="flex flex-col gap-sm">
                {globalModules.map((module) => (
                  <Checkbox
                    key={module.id}
                    label={module.name}
                    checked={selectedModuleIds.includes(module.id)}
                    onChange={(checked) => onToggleModule(module.id, checked)}
                  />
                ))}
              </div>
            ) : (
              <span className="font-body text-xs leading-[1.4] text-text-muted italic">
                No modules available. Add modules from the Modules page.
              </span>
            )}
          </PanelSection>
          <PanelDivider />
          <PanelSection>
            <Button
              variant="danger"
              className="w-full justify-center gap-2 px-3 py-2 text-xs"
              onClick={handleDelete}
            >
              <Trash2Icon size={13} />
              Delete script
            </Button>
          </PanelSection>
        </Panel>
      )}
    </div>
  );
}
