import {
  buildUserscriptJavascript,
  buildUserscriptStylesheet,
  getCompiledOutputBuildOptions,
} from "@/sandbox/compiler";
import {
  buildCompiledCodeEntry,
  hashUserscriptCompileSources,
  digestUserscriptCompileSources,
} from "@shared/compile-metadata";
import type { CompiledCodeEntry, Userscript } from "@shared/model";
import type { RootState } from "../../store";

export function getBuildOptions(state: RootState) {
  return {
    ...getCompiledOutputBuildOptions(state.settings.editorSettings),
    compilerContractVersion: 2,
  };
}

export async function compileJavascriptOrThrow(
  script: Userscript,
  state: RootState
): Promise<string> {
  const result = await buildUserscriptJavascript(
    script,
    script.code.source.typescript,
    getBuildOptions(state)
  );

  if (!result.success) {
    throw new Error(
      `TypeScript compilation error: ${result.error?.message ?? "Unknown error"}`
    );
  }

  return result.code ?? "";
}

export async function compileStylesheetOrThrow(
  script: Userscript,
  state: RootState
): Promise<string> {
  const result = await buildUserscriptStylesheet(
    script.code.source.scss,
    getBuildOptions(state)
  );

  if (!result.success) {
    throw new Error(
      `SCSS compilation error: ${result.error?.message ?? "Unknown error"}`
    );
  }

  return result.code ?? "";
}

export async function compileAllOutputsOrThrow(
  script: Userscript,
  state: RootState
): Promise<CompiledCodeEntry> {
  const [result, css] = await Promise.all([
    buildUserscriptJavascript(
      script,
      script.code.source.typescript,
      getBuildOptions(state)
    ),
    compileStylesheetOrThrow(script, state),
  ]);

  if (!result.success) {
    throw result.error ?? new Error("JavaScript compilation failed.");
  }
  return {
    ...buildCompiledCodeEntry(result.code ?? "", css, {
      ...getBuildOptions(state),
      sourceHash: hashUserscriptCompileSources(script),
      sourceDigest: await digestUserscriptCompileSources(script),
    }),
    manifest: result.manifest,
  };
}
