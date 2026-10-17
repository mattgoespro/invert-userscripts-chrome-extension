import {
  getScriptModulePath,
  type Userscript,
  type UserscriptCompileResult,
} from "@shared/model";
import type { CompiledOutputBuildOptions } from "./compiled-build-metadata";
import { createCompilerRequests } from "./compiler-requests";
import { connectBuildWorker, connectSassSandbox } from "./compiler-transports";

export {
  createCompiledCodeBuildMetadata,
  getCompiledOutputBuildOptions,
  isCompiledCodeBuildCurrent,
  type CompiledOutputBuildOptions,
} from "./compiled-build-metadata";

const javascript = createCompilerRequests({
  connect: connectBuildWorker,
  initializationTimeoutMs: 15000,
  requestTimeoutMs: 30000,
  initializationTimeoutError:
    "Build worker failed to initialize within 15 seconds.",
  initializationFailureError: "Build worker initialization failed.",
  requestTimeoutError: "JavaScript compilation timed out.",
  unavailableError: "Build worker is not available.",
});

const stylesheet = createCompilerRequests({
  connect: connectSassSandbox,
  initializationTimeoutMs: 15000,
  requestTimeoutMs: 10000,
  initializationTimeoutError:
    "SCSS sandbox failed to initialize within 15 seconds.",
  initializationFailureError: "SCSS sandbox initialization failed.",
  requestTimeoutError: "SCSS compilation timed out.",
  unavailableError: "SCSS sandbox is not available.",
});

export function buildUserscriptJavascript(
  script: Pick<Userscript, "shared" | "moduleName" | "id">,
  sourceCode: string,
  options: CompiledOutputBuildOptions
): Promise<UserscriptCompileResult> {
  return javascript.request({
    sourceCode,
    shared: script.shared,
    moduleName: getScriptModulePath(script),
    minify: options.minifyCompiledOutput,
  });
}

export function buildUserscriptStylesheet(
  sourceCode: string,
  options: CompiledOutputBuildOptions
): Promise<UserscriptCompileResult> {
  return SassCompiler.compile(sourceCode, {
    minify: options.minifyCompiledOutput,
  });
}

/** Page-lifetime sandbox, retained across IDE mounts. */
export class SassCompiler {
  static initialize(): Promise<void> {
    return stylesheet.initialize();
  }

  static compile(
    scss: string,
    options: { minify?: boolean } = {}
  ): Promise<UserscriptCompileResult> {
    return stylesheet.request({ scss, minify: options.minify ?? false });
  }
}

export function initializeBuildWorker(): Promise<void> {
  return javascript.initialize();
}

/** Source analysis uses the existing worker without transpiling or minifying. */
export async function analyzeUserscriptModule(
  sourceCode: string
): Promise<import("@shared/modules/manifest").ModuleManifest> {
  const result = await javascript.request({ sourceCode, analysisOnly: true });
  if (!result.success || !result.manifest) {
    throw result.error ?? new Error("Module analysis failed.");
  }
  return result.manifest;
}
