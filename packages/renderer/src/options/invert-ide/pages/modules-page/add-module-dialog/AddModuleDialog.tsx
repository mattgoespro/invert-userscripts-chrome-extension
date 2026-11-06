import { useCallback, useRef, useState } from "react";
import { Button } from "@/shared/components/button/Button";
import { Dialog } from "@/shared/components/dialog/Dialog";
import { Input } from "@/shared/components/input/Input";
import { GlobalModule } from "@shared/model";
import { uuid } from "@shared/utils";
import clsx from "clsx";
import { LoaderCircleIcon } from "lucide-react";
import { validateCdnUrl, validateTypesUrl } from "../validate-module";

type AddModuleDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (module: GlobalModule) => Promise<void>;
};

type ValidationState = {
  validating: boolean;
  cdnError?: string;
  typesError?: string;
  submitError?: string;
};

function getSubmitErrorMessage(error: unknown): string {
  const message =
    error && typeof error === "object" && "message" in error
      ? error.message
      : undefined;
  return typeof message === "string" && message
    ? `Could not add this module: ${message}`
    : "Could not add this module.";
}

export function AddModuleDialog({
  open,
  onClose,
  onSubmit,
}: AddModuleDialogProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [packageName, setPackageName] = useState("");
  const [typeVersion, setTypeVersion] = useState("");
  const [validation, setValidation] = useState<ValidationState>({
    validating: false,
  });

  const nameRef = useRef<HTMLInputElement>(null);
  // Closing the dialog abandons a validation still in flight.
  const submitGenerationRef = useRef(0);
  // Once the add is on its way it can't be abandoned, so closing waits for it.
  const committingRef = useRef(false);

  const resetForm = useCallback(() => {
    setName("");
    setUrl("");
    setPackageName("");
    setTypeVersion("");
    setValidation({ validating: false });
  }, []);

  const handleClose = useCallback(() => {
    if (committingRef.current) {
      return;
    }
    submitGenerationRef.current += 1;
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSubmit = useCallback(async () => {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    const trimmedPackageName = packageName.trim();

    if (!trimmedName || !trimmedUrl) {
      return;
    }

    submitGenerationRef.current += 1;
    const generation = submitGenerationRef.current;
    setValidation({ validating: true });

    // Validate CDN URL
    const cdnError = await validateCdnUrl(trimmedUrl);
    if (generation !== submitGenerationRef.current) {
      return;
    }
    if (cdnError) {
      setValidation({ validating: false, cdnError });
      return;
    }

    // Validate types if package name is provided
    let typesError: string | undefined;
    if (trimmedPackageName) {
      typesError = await validateTypesUrl(
        trimmedPackageName,
        typeVersion.trim()
      );
      if (generation !== submitGenerationRef.current) {
        return;
      }
      if (typesError) {
        setValidation({ validating: false, typesError });
        return;
      }
    }

    const newModule: GlobalModule = {
      id: uuid(),
      name: trimmedName,
      url: trimmedUrl,
      enabled: true,
      ...(trimmedPackageName ? { packageName: trimmedPackageName } : {}),
      ...(typeVersion.trim() ? { typeVersion: typeVersion.trim() } : {}),
    };

    committingRef.current = true;
    try {
      await onSubmit(newModule);
      resetForm();
    } catch (error) {
      console.error("Failed to add module:", error);
      setValidation({
        validating: false,
        submitError: getSubmitErrorMessage(error),
      });
    } finally {
      committingRef.current = false;
    }
  }, [name, url, packageName, typeVersion, resetForm, onSubmit]);

  const hasErrors = !!(validation.cdnError || validation.typesError);
  const canSubmit =
    name.trim().length > 0 && url.trim().length > 0 && !validation.validating;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Add Module"
      minWidth="480px"
    >
      <div className="flex flex-col gap-lg">
        <div className="flex flex-col gap-md">
          <Input
            ref={nameRef}
            label="Name"
            required
            placeholder="e.g. Moment.js"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="flex flex-col gap-2">
            <Input
              label="CDN URL"
              required
              placeholder="e.g. https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.30.1/moment.min.js"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                if (validation.cdnError) {
                  setValidation((prev) => ({ ...prev, cdnError: undefined }));
                }
              }}
            />
            {validation.cdnError && (
              <span className="text-xs text-error-accent">
                {validation.cdnError}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Input
              label="npm package name (optional, for types)"
              placeholder="e.g. moment"
              value={packageName}
              onChange={(event) => {
                setPackageName(event.target.value);
                if (validation.typesError) {
                  setValidation((prev) => ({
                    ...prev,
                    typesError: undefined,
                  }));
                }
              }}
            />
            {validation.typesError && (
              <span className="text-xs text-error-accent">
                {validation.typesError}
              </span>
            )}
            <span className="text-xs text-text-muted">
              Used to provide TypeScript intellisense via @types/*
            </span>
          </div>
        </div>

        <Input
          label="Declaration version (optional)"
          placeholder="e.g. 3.5.32; empty uses latest"
          value={typeVersion}
          onChange={(event) => setTypeVersion(event.target.value)}
        />
        {hasErrors && (
          <div className="flex items-center gap-xs rounded-default border border-error-border bg-error-surface px-3 py-2">
            <span className="text-xs text-error-accent">
              Fix the errors above to add this module.
            </span>
          </div>
        )}
        {validation.submitError && (
          <div
            role="alert"
            className="flex items-center gap-xs rounded-default border border-error-border bg-error-surface px-3 py-2"
          >
            <span className="text-xs text-error-accent">
              {validation.submitError}
            </span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={clsx(validation.validating && "gap-2")}
          >
            {validation.validating && (
              <LoaderCircleIcon size={14} className="animate-spin" />
            )}
            {validation.validating ? "Validating..." : "Add Module"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
