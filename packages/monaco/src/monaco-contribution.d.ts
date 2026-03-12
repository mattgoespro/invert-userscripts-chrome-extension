/**
 * The TypeScript contribution module's bundled .d.ts is `export {}` because the
 * package typings only describe the main entry. This ambient module declaration
 * lets TypeScript resolve the "monaco-editor-ts-contribution" webpack alias —
 * runtime exports are cast via `typeof typescript` in typescript-defaults.ts.
 */
declare module "monaco-editor-ts-contribution";
