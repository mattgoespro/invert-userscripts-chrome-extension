import type { Userscript } from "@shared/model";
export interface RegistrationPlan {
  registrations: chrome.userScripts.RegisteredUserScript[];
  deferred: Array<{ id: string; reason: string }>;
}
/** Preserve legacy loading/completed triggers; idle is not equivalent to completed. */
export function planRegistrations(
  scripts: Array<Pick<Userscript, "id" | "urlPatterns" | "runAt">>
): RegistrationPlan {
  return {
    registrations: [],
    deferred: scripts.map((script) => ({
      id: script.id,
      reason:
        "Automatic registration is deferred to preserve legacy URL matching and navigation timing.",
    })),
  };
}
