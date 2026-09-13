import ts from "typescript";

export interface CompiledJavascriptTransformOptions {
  shared?: boolean;
  moduleName?: string;
}

const SCRIPTS_MODULE_PREFIX = "scripts/";

/**
 * Bare npm/CDN specifiers (`webfontloader`, `jquery`) are type-only at compile
 * time. Runtime values come from injected `globalModules`, so the import must
 * be stripped rather than left as ESM (invalid in a classic page script).
 */
function isBarePackageSpecifier(specifier: string): boolean {
  return (
    specifier.length > 0 &&
    !specifier.startsWith(".") &&
    !specifier.startsWith("/") &&
    !specifier.startsWith(SCRIPTS_MODULE_PREFIX) &&
    !specifier.includes(":")
  );
}

function getImportedModulePath(
  moduleSpecifier: ts.Expression
): string | undefined {
  if (!ts.isStringLiteral(moduleSpecifier)) {
    return undefined;
  }

  const text = moduleSpecifier.text;

  if (!text.startsWith(SCRIPTS_MODULE_PREFIX)) {
    return undefined;
  }

  const remainder = text.slice(SCRIPTS_MODULE_PREFIX.length);
  const slashIndex = remainder.indexOf("/");

  if (slashIndex === -1) {
    return undefined;
  }

  const editor = remainder.slice(slashIndex + 1);

  if (editor !== "main" && editor !== "types") {
    return undefined;
  }

  return remainder.slice(0, slashIndex);
}

function hasRuntimeBindings(importClause?: ts.ImportClause): boolean {
  if (!importClause) {
    return true;
  }

  if (importClause.isTypeOnly) {
    return false;
  }

  if (importClause.name) {
    return true;
  }

  if (!importClause.namedBindings) {
    return false;
  }

  if (ts.isNamespaceImport(importClause.namedBindings)) {
    return true;
  }

  return importClause.namedBindings.elements.some(
    (element) => !element.isTypeOnly
  );
}

function getSharedNamespaceAccessor(moduleName: string): string {
  return `window.__INVERT_SHARED__[${JSON.stringify(moduleName)}]`;
}

function buildNamedImportBinding(
  element: ts.ImportSpecifier,
  sourceFile: ts.SourceFile
): string | null {
  if (element.isTypeOnly) {
    return null;
  }

  const importedName = (element.propertyName ?? element.name).getText(
    sourceFile
  );
  const localName = element.name.getText(sourceFile);

  return importedName === localName
    ? importedName
    : `${importedName}: ${localName}`;
}

function buildSharedImportReplacement(
  statement: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  moduleName: string
): string {
  const moduleAccessor = getSharedNamespaceAccessor(moduleName);
  const importClause = statement.importClause;

  if (!importClause) {
    return `${moduleAccessor};`;
  }

  const replacementLines: string[] = [];

  if (importClause.name) {
    replacementLines.push(
      `const ${importClause.name.getText(sourceFile)} = ${moduleAccessor}["default"];`
    );
  }

  if (importClause.namedBindings) {
    if (ts.isNamespaceImport(importClause.namedBindings)) {
      replacementLines.push(
        `const ${importClause.namedBindings.name.getText(sourceFile)} = ${moduleAccessor};`
      );
    } else {
      const namedBindings = importClause.namedBindings.elements
        .map((element) => buildNamedImportBinding(element, sourceFile))
        .filter((binding): binding is string => Boolean(binding));

      if (namedBindings.length > 0) {
        replacementLines.push(
          `const { ${namedBindings.join(", ")} } = ${moduleAccessor};`
        );
      }
    }
  }

  return replacementLines.join("\n");
}

export function wrapSharedScriptForInjection(
  moduleName: string,
  compiledJs: string
): string {
  const sourceFile = ts.createSourceFile(
    "compiled.js",
    compiledJs,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.JS
  );

  const replacements: Array<{ start: number; end: number; text: string }> = [];
  const assignments: string[] = [];
  let defaultCounter = 0;

  const stripExportRange = (
    exportModifier: ts.Modifier,
    trailingModifier?: ts.Modifier
  ): { start: number; end: number } => {
    const lastStripped = trailingModifier ?? exportModifier;
    let end = lastStripped.getEnd();

    while (end < compiledJs.length && /\s/.test(compiledJs[end])) {
      end++;
    }

    return { start: exportModifier.getStart(sourceFile), end };
  };

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.moduleSpecifier) {
        throw new Error(
          `Shared module "${moduleName}" contains a re-export from ` +
            `"${(statement.moduleSpecifier as ts.StringLiteral).text}", ` +
            `which is not supported in shared scripts.`
        );
      }

      if (
        !statement.exportClause ||
        !ts.isNamedExports(statement.exportClause)
      ) {
        continue;
      }

      for (const element of statement.exportClause.elements) {
        const localName = (element.propertyName || element.name).getText(
          sourceFile
        );
        const exportedName = element.name.getText(sourceFile);
        assignments.push(
          `__ns__[${JSON.stringify(exportedName)}]=${localName}`
        );
      }

      replacements.push({
        start: statement.getStart(sourceFile),
        end: statement.getEnd(),
        text: "",
      });
      continue;
    }

    if (ts.isExportAssignment(statement)) {
      const expr = statement.expression.getText(sourceFile);
      const defName = `__default_${defaultCounter++}__`;
      assignments.push(`__ns__["default"]=${defName}`);
      replacements.push({
        start: statement.getStart(sourceFile),
        end: statement.getEnd(),
        text: `const ${defName} = ${expr};`,
      });
      continue;
    }

    const modifiers = ts.canHaveModifiers(statement)
      ? ts.getModifiers(statement)
      : undefined;
    const exportModifier = modifiers?.find(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword
    );
    if (!exportModifier) {
      continue;
    }

    const defaultModifier = modifiers?.find(
      (m) => m.kind === ts.SyntaxKind.DefaultKeyword
    );

    if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const name = decl.name.getText(sourceFile);
          assignments.push(`__ns__[${JSON.stringify(name)}]=${name}`);
        }
      }

      const { start, end } = stripExportRange(exportModifier);
      replacements.push({ start, end, text: "" });
      continue;
    }

    if (
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement)
    ) {
      const nameNode = statement.name;

      if (defaultModifier) {
        if (nameNode) {
          const name = nameNode.getText(sourceFile);
          assignments.push(`__ns__["default"]=${name}`);
          const { start, end } = stripExportRange(
            exportModifier,
            defaultModifier
          );
          replacements.push({ start, end, text: "" });
        } else {
          const defName = `__default_${defaultCounter++}__`;
          assignments.push(`__ns__["default"]=${defName}`);
          const { start, end } = stripExportRange(
            exportModifier,
            defaultModifier
          );
          replacements.push({
            start,
            end,
            text: `const ${defName} = `,
          });
        }
        continue;
      }

      if (nameNode) {
        const name = nameNode.getText(sourceFile);
        assignments.push(`__ns__[${JSON.stringify(name)}]=${name}`);
      }

      const { start, end } = stripExportRange(exportModifier);
      replacements.push({ start, end, text: "" });
    }
  }

  let code = compiledJs;
  for (const replacement of replacements.reverse()) {
    code =
      code.slice(0, replacement.start) +
      replacement.text +
      code.slice(replacement.end);
  }

  const assignmentsCode = assignments.join(";");
  const iifeOpen = containsTopLevelAwait(compiledJs)
    ? "(async function(){"
    : "(function(){";

  return [
    iifeOpen,
    "window.__INVERT_SHARED__=window.__INVERT_SHARED__||{};",
    "var __ns__={};",
    code,
    ";",
    assignmentsCode,
    ";",
    `window.__INVERT_SHARED__[${JSON.stringify(moduleName)}]=__ns__;`,
    "})();",
  ].join("");
}

export function resolveSharedImports(compiledJs: string): string {
  const sourceFile = ts.createSourceFile(
    "compiled.js",
    compiledJs,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.JS
  );
  const replacements: Array<{ start: number; end: number; text: string }> = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) {
      continue;
    }

    if (!hasRuntimeBindings(statement.importClause)) {
      replacements.push({
        start: statement.getStart(sourceFile),
        end: statement.getEnd(),
        text: "",
      });
      continue;
    }

    const moduleName = getImportedModulePath(statement.moduleSpecifier);

    if (!moduleName) {
      const specifier = ts.isStringLiteral(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : undefined;

      if (specifier && isBarePackageSpecifier(specifier)) {
        replacements.push({
          start: statement.getStart(sourceFile),
          end: statement.getEnd(),
          text: "",
        });
      }

      continue;
    }

    replacements.push({
      start: statement.getStart(sourceFile),
      end: statement.getEnd(),
      text: buildSharedImportReplacement(statement, sourceFile, moduleName),
    });
  }

  if (replacements.length === 0) {
    return compiledJs;
  }

  let code = compiledJs;

  for (const replacement of replacements.reverse()) {
    code =
      code.slice(0, replacement.start) +
      replacement.text +
      code.slice(replacement.end);
  }

  return code;
}

export function prepareCompiledJavascript(
  compiledJs: string,
  options: CompiledJavascriptTransformOptions
): string {
  let code = resolveSharedImports(compiledJs);

  assertNoUnsupportedModuleRuntime(code);

  if (options.shared && options.moduleName) {
    code = wrapSharedScriptForInjection(options.moduleName, code);
  } else {
    code = stripModuleSyntaxForClassicScript(code);

    if (containsTopLevelAwait(code)) {
      code = wrapClassicScriptForTopLevelAwait(code);
    }
  }

  assertClassicScriptCompatible(code);

  return code;
}

function applyReplacements(
  compiledJs: string,
  replacements: Array<{ start: number; end: number; text: string }>
): string {
  let code = compiledJs;

  for (const replacement of replacements.reverse()) {
    code =
      code.slice(0, replacement.start) +
      replacement.text +
      code.slice(replacement.end);
  }

  return code;
}

function specifierText(moduleSpecifier: ts.Expression): string {
  return ts.isStringLiteral(moduleSpecifier)
    ? moduleSpecifier.text
    : moduleSpecifier.getText();
}

function assertNoUnsupportedModuleRuntime(compiledJs: string): void {
  const sourceFile = ts.createSourceFile(
    "compiled.js",
    compiledJs,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.JS
  );

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const spec = node.arguments[0];
      const label = spec ? specifierText(spec as ts.Expression) : "import()";
      throw new Error(
        `Dynamic import(${JSON.stringify(label)}) is not supported in injected userscripts. Use a static import from "scripts/<module>/main".`
      );
    }

    if (
      ts.isMetaProperty(node) &&
      node.keywordToken === ts.SyntaxKind.ImportKeyword
    ) {
      throw new Error(
        "import.meta is not supported in injected userscripts (classic page scripts)."
      );
    }

    if (ts.isImportDeclaration(node)) {
      const spec = specifierText(node.moduleSpecifier);
      throw new Error(
        `Unsupported import "${spec}" in userscript output. Only static imports from "scripts/<module>/main" (or "/types") are rewritten for page injection.`
      );
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

/**
 * Strip leftover ESM export syntax so the result is valid as a classic
 * (non-module) script. Shared scripts use wrapSharedScriptForInjection instead.
 */
export function stripModuleSyntaxForClassicScript(compiledJs: string): string {
  const sourceFile = ts.createSourceFile(
    "compiled.js",
    compiledJs,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.JS
  );
  const replacements: Array<{ start: number; end: number; text: string }> = [];

  const stripExportRange = (
    exportModifier: ts.Modifier,
    trailingModifier?: ts.Modifier
  ): { start: number; end: number } => {
    const lastStripped = trailingModifier ?? exportModifier;
    let end = lastStripped.getEnd();

    while (end < compiledJs.length && /\s/.test(compiledJs[end])) {
      end++;
    }

    return { start: exportModifier.getStart(sourceFile), end };
  };

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.moduleSpecifier) {
        throw new Error(
          `Re-export from "${specifierText(statement.moduleSpecifier)}" is not supported in injected userscripts.`
        );
      }

      replacements.push({
        start: statement.getStart(sourceFile),
        end: statement.getEnd(),
        text: "",
      });
      continue;
    }

    if (ts.isExportAssignment(statement)) {
      const expr = statement.expression.getText(sourceFile);
      replacements.push({
        start: statement.getStart(sourceFile),
        end: statement.getEnd(),
        text: `${expr};`,
      });
      continue;
    }

    const modifiers = ts.canHaveModifiers(statement)
      ? ts.getModifiers(statement)
      : undefined;
    const exportModifier = modifiers?.find(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword
    );

    if (!exportModifier) {
      continue;
    }

    const defaultModifier = modifiers?.find(
      (m) => m.kind === ts.SyntaxKind.DefaultKeyword
    );

    if (defaultModifier) {
      const { start, end } = stripExportRange(exportModifier, defaultModifier);
      const anonymousDefault =
        (ts.isFunctionDeclaration(statement) ||
          ts.isClassDeclaration(statement)) &&
        !statement.name;

      // `export default function() {}` / `class {}` would otherwise become a
      // nameless declaration, which is a SyntaxError in classic scripts.
      replacements.push({
        start,
        end,
        text: anonymousDefault ? "void " : "",
      });
      continue;
    }

    const { start, end } = stripExportRange(exportModifier);
    replacements.push({ start, end, text: "" });
  }

  return applyReplacements(compiledJs, replacements);
}

function isFunctionBoundary(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

function containsTopLevelAwait(compiledJs: string): boolean {
  const sourceFile = ts.createSourceFile(
    "compiled.js",
    compiledJs,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.JS
  );

  const visit = (node: ts.Node): boolean => {
    if (isFunctionBoundary(node)) {
      return false;
    }

    if (ts.isAwaitExpression(node)) {
      return true;
    }

    if (ts.isForOfStatement(node) && node.awaitModifier) {
      return true;
    }

    let found = false;
    ts.forEachChild(node, (child) => {
      if (visit(child)) {
        found = true;
      }
    });

    return found;
  };

  return visit(sourceFile);
}

function wrapClassicScriptForTopLevelAwait(compiledJs: string): string {
  return `(async () => {\n${compiledJs}\n})();`;
}

function assertClassicScriptCompatible(compiledJs: string): void {
  const sourceFile = ts.createSourceFile(
    "compiled.js",
    compiledJs,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.JS
  );

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      throw new Error(
        "Compiled userscript still contains ESM import/export syntax, which is invalid in a classic page script."
      );
    }

    if (ts.isExportAssignment(node)) {
      throw new Error(
        "Compiled userscript still contains `export default`, which is invalid in a classic page script."
      );
    }

    if (
      ts.canHaveModifiers(node) &&
      ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      throw new Error(
        "Compiled userscript still contains an `export` keyword, which is invalid in a classic page script."
      );
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      throw new Error(
        "Compiled userscript still contains dynamic import(), which is invalid in a classic page script."
      );
    }

    if (
      ts.isMetaProperty(node) &&
      node.keywordToken === ts.SyntaxKind.ImportKeyword
    ) {
      throw new Error(
        "Compiled userscript still contains import.meta, which is invalid in a classic page script."
      );
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}
