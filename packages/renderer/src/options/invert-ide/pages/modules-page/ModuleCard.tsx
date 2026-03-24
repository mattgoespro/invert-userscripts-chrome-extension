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
    <div className="bg-surface-raised border-border rounded-default p-md gap-md hover:border-accent-muted flex flex-col border transition-colors duration-150">
      <div className="flex-1">
        <Typography
          variant="code"
          className="text-syntax-type mb-sm block text-[15px]"
        >
          {module.name}
        </Typography>
        <div className="text-text-muted p-sm px-md bg-surface-overlay rounded-default border-border-subtle border font-mono text-xs break-all">
          {module.url}
        </div>
      </div>
      <div className="pt-sm border-border-subtle flex items-center justify-between border-t">
        <Checkbox
          label="Enabled"
          checked={module.enabled}
          onChange={onToggle}
        />
        <IconButton icon={DeleteIcon} variant="danger" onClick={onDelete}>
          <DeleteIcon />
        </IconButton>
      </div>
    </div>
  );
}
