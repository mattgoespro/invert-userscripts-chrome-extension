import { isTrustedExtensionSender } from "@shared/publication/protocol";
import type { RepositoryRequest } from "@shared/publication/client";
import { handleRepositoryRequest } from "./coordinator";
export function onPublicationMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  respond: (response: unknown) => void
): boolean | undefined {
  if (
    !message ||
    typeof message !== "object" ||
    !("type" in message) ||
    typeof message.type !== "string" ||
    !message.type.startsWith("publication.")
  ) {
    return;
  }
  if (!isTrustedExtensionSender(sender, chrome.runtime.id)) {
    respond({ error: "Untrusted document command sender." });
    return false;
  }
  void handleRepositoryRequest(message as RepositoryRequest).then(
    respond,
    (error) => {
      respond({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  );
  return true;
}
