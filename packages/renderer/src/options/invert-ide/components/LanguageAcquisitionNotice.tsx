import { useSyncExternalStore } from "react";
import {
  getLanguageAcquisitionError,
  subscribeLanguageAcquisition,
  retryLanguageAcquisition,
} from "@packages/monaco";
import { Button } from "@/shared/components/button/Button";
export function LanguageAcquisitionNotice() {
  const message = useSyncExternalStore(
    subscribeLanguageAcquisition,
    getLanguageAcquisitionError
  );
  if (!message) {
    return null;
  }
  return (
    <div
      role="status"
      className="flex items-center gap-sm border-b border-border bg-surface-raised p-md text-sm text-text-muted-strong"
    >
      <span>Some library declarations could not be loaded. {message}</span>
      <Button variant="secondary" onClick={retryLanguageAcquisition}>
        Retry declarations
      </Button>
    </div>
  );
}
