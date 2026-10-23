import { Checkbox } from "@/shared/components/checkbox/Checkbox";
import { IconButton } from "@/shared/components/icon-button/IconButton";
import { GlobalModule } from "@shared/model";
import { LoaderCircleIcon, Trash2Icon } from "lucide-react";
import clsx from "clsx";

export type TypesValidationStatus = {
  status: "idle" | "checking" | "ok" | "error";
  error?: string;
};

type ModuleCardProps = {
  module: GlobalModule;
  usedBy: number;
  typesValidation?: TypesValidationStatus;
  onToggle: () => void;
  onDelete: () => void;
};

function TypesCell({
  module,
  typesValidation,
}: {
  module: GlobalModule;
  typesValidation?: TypesValidationStatus;
}) {
  if (!module.packageName) {
    return <span className="text-text-muted-strong">No types</span>;
  }

  const label = `@types/${module.packageName}${module.typeVersion ? "@" + module.typeVersion : ""}`;

  return (
    <span className="flex min-w-0 flex-col">
      <span
        className="truncate font-mono text-xs text-text-muted"
        title={label}
      >
        {label}
      </span>
      {typesValidation?.status === "checking" && (
        <span
          className="flex items-center gap-1 text-xs text-text-muted-strong"
          aria-label="Checking types"
        >
          <LoaderCircleIcon size={11} className="animate-spin" aria-hidden />
          Checking…
        </span>
      )}
      {typesValidation?.status === "ok" && (
        <span
          className="text-xs text-success"
          title="Types OK"
          aria-label="Types reachable"
        >
          Types found
        </span>
      )}
      {typesValidation?.status === "error" && (
        <span
          className="truncate text-xs text-error-accent"
          title={typesValidation.error}
        >
          {typesValidation.error ?? "Types unreachable"}
        </span>
      )}
    </span>
  );
}

/** One row of the modules table. */
export function ModuleCard({
  module,
  usedBy,
  typesValidation,
  onToggle,
  onDelete,
}: ModuleCardProps) {
  return (
    <tr
      data-testid="module-row"
      className="border-t border-border-subtle align-middle transition-colors duration-150 hover:bg-hover-overlay"
    >
      <td className="px-md py-2">
        <Checkbox checked={module.enabled} onChange={onToggle} />
      </td>
      <td className="px-md py-2">
        <span
          className={clsx(
            "block truncate font-semibold",
            module.enabled ? "text-foreground" : "text-text-muted-strong"
          )}
          data-testid="module-name"
        >
          {module.name}
        </span>
      </td>
      <td className="px-md py-2">
        <span
          className="block truncate font-mono text-xs text-text-muted"
          title={module.url}
        >
          {module.url}
        </span>
      </td>
      <td className="px-md py-2">
        <TypesCell module={module} typesValidation={typesValidation} />
      </td>
      <td className="px-md py-2 text-text-muted">
        {usedBy === 0 ? "Unused" : `${usedBy} script${usedBy === 1 ? "" : "s"}`}
      </td>
      <td className="px-sm py-2 text-right">
        <IconButton
          icon={Trash2Icon}
          variant="danger"
          size="sm"
          title={`Delete ${module.name}`}
          onClick={onDelete}
        />
      </td>
    </tr>
  );
}
