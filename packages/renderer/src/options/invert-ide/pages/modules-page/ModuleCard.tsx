import { Checkbox } from "@/shared/components/checkbox/Checkbox";
import { IconButton } from "@/shared/components/icon-button/IconButton";
import { Typography } from "@/shared/components/typography/Typography";
import { GlobalModule } from "@shared/model";
import { DeleteIcon } from "lucide-react";

type ModuleCardProps = {
  module: GlobalModule;
  onToggle: () => void;
  onDelete: () => void;
};

export function ModuleCard({ module, onToggle, onDelete }: ModuleCardProps) {
  return (
    <div className="flex items-center gap-sm rounded-default border border-border bg-surface-raised px-md py-sm transition-colors duration-150 hover:border-accent-muted">
      <Checkbox checked={module.enabled} onChange={onToggle} />
      <Typography variant="code" className="shrink-0 text-sm text-syntax-type">
        {module.name}
      </Typography>
      {module.packageName && (
        <span className="shrink-0 font-mono text-[10px] text-text-muted-faint">
          @types/{module.packageName}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-muted">
        {module.url}
      </span>
      <IconButton icon={DeleteIcon} variant="danger" onClick={onDelete} />
    </div>
  );
}
