import ts from "typescript";

export interface CompiledJavascriptTransformOptions {
  shared?: boolean;
  moduleName?: string;
}

const SHARED_MODULE_PREFIX = "shared/";
const SCRIPTS_MODULE_PREFIX = "scripts/";

function getImportedModulePath(
  moduleSpecifier: ts.Expression
): string | undefined {
  if (!ts.isStringLiteral(moduleSpecifier)) {
    return undefined;
  }

  const text = moduleSpecifier.text;

  if (text.startsWith(SHARED_MODULE_PREFIX)) {
    return text.slice(SHARED_MODULE_PREFIX.length);
  }

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

function collectSharedImportModuleNames(
  sourceCode: string,
  scriptKind: ts.ScriptKind
): string[] {
  const sourceFile = ts.createSourceFile(
    scriptKind === ts.ScriptKind.JS ? "compiled.js" : "source.ts",
    sourceCode,
    ts.ScriptTarget.ES2020,
    true,
    scriptKind
  );
  const moduleNames = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) {
      continue;
    }

    const moduleName = getImportedModulePath(statement.moduleSpecifier);

    if (!moduleName || !hasRuntimeBindings(statement.importClause)) {
      continue;
    }

    moduleNames.add(moduleName);
  }

  return [...moduleNames];
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

export function getSharedImportModuleNames(sourceCode: string): string[] {
  return collectSharedImportModuleNames(sourceCode, ts.ScriptKind.TS);
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

  return [
    "(function(){",
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

    const moduleName = getImportedModulePath(statement.moduleSpecifier);

    if (!moduleName || !hasRuntimeBindings(statement.importClause)) {
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

  if (options.shared && options.moduleName) {
    code = wrapSharedScriptForInjection(options.moduleName, code);
  }

  return code;
}
