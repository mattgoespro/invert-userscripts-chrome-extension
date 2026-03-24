/**
 * The TypeScript contribution module's ESM subpath has no standalone type
 * declarations — the package's typings only cover the main entry. This ambient
 * module declaration lets TypeScript resolve the direct subpath import.
 * Runtime exports are cast via `typeof typescript` in typescript-defaults.ts.
 */
declare module "monaco-editor/esm/vs/language/typescript/monaco.contribution";
