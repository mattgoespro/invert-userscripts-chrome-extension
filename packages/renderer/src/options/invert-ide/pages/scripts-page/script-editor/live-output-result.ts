import type { UserscriptCompileResult } from "@shared/model";

export interface LiveBuildOutput {
  code: string;
  /** Why the build failed, or null when `code` is its real output. */
  error: string | null;
}

const UNKNOWN_BUILD_ERROR = "The build failed without an error message.";

function describeBuildError(error: unknown): string {
  const message =
    error && typeof error === "object" && "message" in error
      ? error.message
      : undefined;
  return typeof message === "string" && message ? message : UNKNOWN_BUILD_ERROR;
}

/** Tells a failed build apart from one that legitimately produced no output. */
export function readBuildOutput(
  result: UserscriptCompileResult
): LiveBuildOutput {
  return result.success
    ? { code: result.code ?? "", error: null }
    : { code: "", error: describeBuildError(result.error) };
}

export function readBuildRejection(error: unknown): LiveBuildOutput {
  return { code: "", error: describeBuildError(error) };
}
