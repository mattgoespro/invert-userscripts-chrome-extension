import { Button } from "@/shared/components/button/Button";
import { IconButton } from "@/shared/components/icon-button/IconButton";
import {
  Panel,
  PanelHeader,
  PanelSection,
} from "@/shared/components/panel/Panel";
import { DownloadIcon, EllipsisVerticalIcon, UploadIcon } from "lucide-react";
import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";

type ScriptsActionsMenuProps = {
  onImportClick: () => void;
  onExportClick: () => void;
};

export function ScriptsActionsMenu({
  onImportClick,
  onExportClick,
}: ScriptsActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      wrapperRef.current &&
      !wrapperRef.current.contains(event.target as Node)
    ) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleClickOutside]);

  const handleAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="relative shrink-0" ref={wrapperRef}>
      <IconButton
        icon={EllipsisVerticalIcon}
        variant="ghost"
        size="sm"
        className={clsx(open && "bg-hover-overlay")}
        onClick={() => setOpen((current) => !current)}
        title="Script list options"
        aria-haspopup="menu"
        aria-expanded={open}
      />
      {open && (
        <Panel minWidth="14rem">
          <PanelHeader>script list</PanelHeader>
          <PanelSection className="gap-sm">
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={() => handleAction(onImportClick)}
            >
              <UploadIcon size={14} />
              Import
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={() => handleAction(onExportClick)}
            >
              <DownloadIcon size={14} />
              Export
            </Button>
          </PanelSection>
        </Panel>
      )}
    </div>
  );
}
