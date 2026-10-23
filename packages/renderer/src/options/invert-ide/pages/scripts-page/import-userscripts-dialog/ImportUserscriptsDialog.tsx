import { Button } from "@/shared/components/button/Button";
import { Dialog } from "@/shared/components/dialog/Dialog";
import { Input } from "@/shared/components/input/Input";
import { useAppSelector } from "@/shared/store/hooks";
import { selectModules } from "@/shared/store/slices/modules";
import { selectSharedUserscripts } from "@/shared/store/slices/userscripts";
import {
  UserscriptsTransferFile,
  validateUserscriptsTransferFile,
} from "@/shared/store/slices/userscripts/transfer.userscripts";
import { LoaderCircleIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

type ImportUserscriptsDialogProps = {
  open: boolean;
  importing: boolean;
  onClose: () => void;
  onImport: (file: UserscriptsTransferFile) => Promise<void>;
};

export function ImportUserscriptsDialog({
  open,
  importing,
  onClose,
  onImport,
}: ImportUserscriptsDialogProps) {
  const sharedScripts = useAppSelector(selectSharedUserscripts);
  const modulesMap = useAppSelector(selectModules);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [validatedFile, setValidatedFile] = useState<UserscriptsTransferFile>();
  const [validating, setValidating] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const existingSharedModuleNames = useMemo(
    () =>
      sharedScripts
        .map((script) => script.moduleName.trim())
        .filter((moduleName) => moduleName.length > 0),
    [sharedScripts]
  );

  const resetState = useCallback(() => {
    setSelectedPath("");
    setValidatedFile(undefined);
    setValidating(false);
    setErrors([]);
    setWarnings([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  const handleClose = useCallback(() => {
    if (importing) {
      return;
    }

    resetState();
    onClose();
  }, [importing, onClose, resetState]);

  const handleSelectClick = useCallback(() => {
    if (importing || validating || !fileInputRef.current) {
      return;
    }

    fileInputRef.current.value = "";
    fileInputRef.current.click();
  }, [importing, validating]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const nextSelectedPath = event.target.value || file?.name || "";

      setSelectedPath(nextSelectedPath);
      setValidatedFile(undefined);
      setErrors([]);
      setWarnings([]);

      if (!file) {
        return;
      }

      setValidating(true);

      try {
        const contents = await file.text();
        const globalModules = modulesMap;

        let parsedFile: unknown;

        try {
          parsedFile = JSON.parse(contents);
        } catch {
          setErrors(["The selected file contains invalid JSON."]);
          return;
        }

        const validation = validateUserscriptsTransferFile(parsedFile, {
          globalModules,
          existingSharedModuleNames,
        });

        setErrors(validation.errors);
        setWarnings(
          validation.missingGlobalModuleIds.map(
            (moduleId) =>
              `Global module \"${moduleId}\" is not currently loaded and will be removed during import.`
          )
        );
        setValidatedFile(validation.file);
      } catch (error) {
        setErrors([
          error instanceof Error
            ? error.message
            : "Failed to read the selected file.",
        ]);
      } finally {
        setValidating(false);
      }
    },
    [existingSharedModuleNames]
  );

  const handleImport = useCallback(async () => {
    if (!validatedFile || importing || validating) {
      return;
    }

    try {
      await onImport(validatedFile);
      handleClose();
    } catch {
      // Keep the dialog open so the user can review the selected file.
    }
  }, [handleClose, importing, onImport, validatedFile, validating]);

  const canImport = validatedFile != null && !validating && !importing;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Import Userscripts"
      minWidth="34rem"
    >
      <div className="flex flex-col gap-lg">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex flex-col gap-sm">
          <div className="flex items-center gap-sm">
            <Input
              className="flex-1 [&_input]:cursor-pointer [&_input::placeholder]:text-text-muted [&_input:disabled]:cursor-not-allowed"
              aria-label="Select userscripts file"
              aria-describedby="userscripts-import-caption"
              value={selectedPath}
              placeholder="No userscripts file selected"
              readOnly
              disabled={importing || validating}
              onClick={handleSelectClick}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleSelectClick();
                }
              }}
            />
            <Button
              variant="secondary"
              onClick={handleSelectClick}
              disabled={importing || validating}
            >
              {validating && (
                <LoaderCircleIcon size={14} className="animate-spin" />
              )}
              {validating ? "Validating..." : "Select"}
            </Button>
          </div>
          <span
            id="userscripts-import-caption"
            className="font-mono text-xs text-text-muted"
          >
            Choose a JSON export file containing userscripts to append to this
            workspace.
          </span>
        </div>

        {errors.length > 0 && (
          <div className="flex flex-col gap-xs rounded-default border border-error-border bg-error-surface px-md py-sm">
            <span className="text-xs font-semibold text-error-accent">
              Validation errors
            </span>
            <ul className="list-disc space-y-1 pl-4 text-xs text-error-accent">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="flex flex-col gap-xs rounded-default border border-toast-warning-border bg-toast-warning-surface px-md py-sm">
            <span className="text-xs font-semibold text-toast-warning-accent">
              Import warnings
            </span>
            <ul className="list-disc space-y-1 pl-4 text-xs text-toast-warning-accent">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {validatedFile && errors.length === 0 && (
          <div className="rounded-default border border-border bg-surface-base px-md py-sm">
            <span className="text-xs text-text-muted-strong">
              Ready to import {validatedFile.userscripts.length} userscript
              {validatedFile.userscripts.length === 1 ? "" : "s"}.
            </span>
          </div>
        )}

        <div className="flex items-center justify-end gap-sm">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={importing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!canImport}
            className={clsx(importing && "gap-2")}
          >
            {importing && (
              <LoaderCircleIcon size={14} className="animate-spin" />
            )}
            {importing ? "Importing..." : "Import"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
