import type { Userscript } from "@shared/model";

export const RUN_AT_OPTIONS = [
  {
    value: "beforePageLoad",
    label: "Before page load",
    hint: "Injected as soon as the page starts loading",
  },
  {
    value: "afterPageLoad",
    label: "After page load",
    hint: "Injected once the page has finished loading",
  },
] as const satisfies readonly {
  value: Userscript["runAt"];
  label: string;
  hint: string;
}[];

export function describeRunAt(runAt: Userscript["runAt"] | undefined): string {
  return runAt === "afterPageLoad"
    ? "Runs after page load"
    : "Runs before page load";
}
