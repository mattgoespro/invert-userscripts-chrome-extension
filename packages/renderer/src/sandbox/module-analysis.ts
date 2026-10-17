import ts from "typescript";
import type { ModuleManifest } from "@shared/modules/manifest";

/** Worker-only AST implementation; shared consumers receive a plain manifest. */
export function analyzeModule(
  source: string,
  compiledCode?: string
): ModuleManifest {
  const file = ts.createSourceFile(
    "main.ts",
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const manifest: ModuleManifest = {
    version: 1,
    source,
    imports: [],
    diagnostics: [],
    ...(compiledCode === undefined
      ? {}
      : { awaitCompletion: hasAsyncCompletion(compiledCode) }),
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const specifier = node.moduleSpecifier.text;
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const runtime =
        !clause ||
        (!clause.isTypeOnly &&
          Boolean(
            clause.name ||
            (bindings &&
              (ts.isNamespaceImport(bindings) ||
                bindings.elements.some((item) => !item.isTypeOnly)))
          ));
      const match = /^scripts\/([^/]+)\/(main|types)$/.exec(specifier);
      manifest.imports.push({
        specifier,
        runtime,
        ...(match
          ? { modulePath: match[1], target: match[2] as "main" | "types" }
          : {}),
      });
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      !node.isTypeOnly &&
      (!node.exportClause ||
        !ts.isNamedExports(node.exportClause) ||
        node.exportClause.elements.some((item) => !item.isTypeOnly))
    ) {
      manifest.diagnostics.push({
        kind: "re-export",
        message: "Runtime re-exports are not supported.",
      });
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      manifest.diagnostics.push({
        kind: "dynamic-import",
        message: "Dynamic imports are not supported in injected scripts.",
      });
    }
    if (
      ts.isMetaProperty(node) &&
      node.keywordToken === ts.SyntaxKind.ImportKeyword
    ) {
      manifest.diagnostics.push({
        kind: "import-meta",
        message: "import.meta is not supported in injected scripts.",
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return manifest;
}

/** Parse in the compiler worker, never guess program shape in the background. */
export function hasAsyncCompletion(code: string): boolean {
  return getAsyncCompletionExpression(code) !== undefined;
}

export function getAsyncCompletionExpression(code: string): string | undefined {
  const file = ts.createSourceFile(
    "compiled.js",
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  if (
    file.statements.length !== 1 ||
    !ts.isExpressionStatement(file.statements[0])
  ) {
    return undefined;
  }
  let expression = file.statements[0].expression;
  while (ts.isParenthesizedExpression(expression)) {
    expression = expression.expression;
  }
  if (!ts.isCallExpression(expression)) {
    return undefined;
  }
  let callee: ts.Expression = expression.expression;
  while (ts.isParenthesizedExpression(callee)) {
    callee = callee.expression;
  }
  const asynchronous =
    ((ts.isFunctionExpression(callee) && !callee.asteriskToken) ||
      ts.isArrowFunction(callee)) &&
    Boolean(
      callee.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword
      )
    );
  return asynchronous ? file.statements[0].expression.getText(file) : undefined;
}
