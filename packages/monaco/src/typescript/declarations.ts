import ts from "typescript";

interface DeclarationEntry {
  suppressKey: string;
  text: string;
}

/**
 * Generates a TypeScript ambient module declaration from shared script source code.
 * Uses the TypeScript compiler API to parse the AST and extract all exported members,
 * producing `.d.ts`-style declarations that Monaco's TypeScript language service can
 * consume for `import { ... } from "shared/moduleName"` intellisense.
 */
export function generateScriptMainModuleDeclaration(sourceCode: string): string {
  return collectSourceExportDeclarations(sourceCode)
    .map((entry) => entry.text)
    .join("\n");
}

export function generateScriptTypesModuleDeclaration(
  typeDefinitions = ""
): string {
  const { generatedEntries } =
    collectTypeDefinitionModuleExports(typeDefinitions);

  return generatedEntries.map((entry) => entry.text).join("\n");
}

export function generateSharedScriptDeclaration(
  _moduleName: string,
  sourceCode: string,
  typeDefinitions = ""
): string {
  const sourceEntries = collectSourceExportDeclarations(sourceCode);
  const {
    explicitExportSuppressions,
    generatedEntries: typeDefinitionEntries,
  } = collectTypeDefinitionModuleExports(typeDefinitions);
  const generatedTypeDefinitionSuppressions = new Set(
    typeDefinitionEntries.map((entry) => entry.suppressKey)
  );

  const filteredSourceEntries = sourceEntries.filter(
    (entry) =>
      !explicitExportSuppressions.has(entry.suppressKey) &&
      !generatedTypeDefinitionSuppressions.has(entry.suppressKey)
  );

  return [
    [...filteredSourceEntries, ...typeDefinitionEntries]
      .map((entry) => entry.text)
      .join("\n"),
    typeDefinitions.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function collectSourceExportDeclarations(sourceCode: string): DeclarationEntry[] {
  const sourceFile = ts.createSourceFile(
    "source.ts",
    sourceCode,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.TS
  );
  const printer = ts.createPrinter({ removeComments: true });
  const entries: DeclarationEntry[] = [];

  for (const statement of sourceFile.statements) {
    if (!hasExportModifier(statement)) {
      continue;
    }

    appendDeclarationEntries(
      entries,
      collectDeclarationEntriesFromStatement(statement, sourceFile, printer)
    );
  }

  return dedupeDeclarationEntries(entries);
}

function collectTypeDefinitionModuleExports(typeDefinitions: string): {
  explicitExportSuppressions: Set<string>;
  generatedEntries: DeclarationEntry[];
} {
  if (!typeDefinitions.trim()) {
    return {
      explicitExportSuppressions: new Set<string>(),
      generatedEntries: [],
    };
  }

  const sourceFile = ts.createSourceFile(
    "types.d.ts",
    typeDefinitions,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.TS
  );
  const printer = ts.createPrinter({ removeComments: true });
  const explicitExportSuppressions = new Set<string>();
  const generatedEntries: DeclarationEntry[] = [];

  for (const statement of sourceFile.statements) {
    if (hasExportModifier(statement)) {
      for (const entry of collectDeclarationEntriesFromStatement(
        statement,
        sourceFile,
        printer
      )) {
        explicitExportSuppressions.add(entry.suppressKey);
      }

      continue;
    }

    if (!isDeclareGlobalStatement(statement)) {
      continue;
    }

    if (!statement.body || !ts.isModuleBlock(statement.body)) {
      continue;
    }

    for (const globalStatement of statement.body.statements) {
      appendDeclarationEntries(
        generatedEntries,
        collectDeclarationEntriesFromStatement(
          globalStatement,
          sourceFile,
          printer
        )
      );
    }
  }

  return {
    explicitExportSuppressions,
    generatedEntries: dedupeDeclarationEntries(generatedEntries),
  };
}

function appendDeclarationEntries(
  target: DeclarationEntry[],
  entries: DeclarationEntry[]
): void {
  for (const entry of entries) {
    target.push(entry);
  }
}

function dedupeDeclarationEntries(
  entries: DeclarationEntry[]
): DeclarationEntry[] {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const key = `${entry.suppressKey}:${entry.text}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function collectDeclarationEntriesFromStatement(
  statement: ts.Statement,
  sourceFile: ts.SourceFile,
  printer: ts.Printer
): DeclarationEntry[] {
  if (ts.isVariableStatement(statement)) {
    return emitVariableDeclarationEntries(statement, sourceFile, printer);
  }

  if (ts.isFunctionDeclaration(statement)) {
    const entry = emitFunctionDeclarationEntry(statement, sourceFile, printer);
    return entry ? [entry] : [];
  }

  if (ts.isClassDeclaration(statement)) {
    const entry = emitClassDeclarationEntry(statement, sourceFile, printer);
    return entry ? [entry] : [];
  }

  if (ts.isInterfaceDeclaration(statement)) {
    return [emitInterfaceDeclarationEntry(statement, sourceFile, printer)];
  }

  if (ts.isTypeAliasDeclaration(statement)) {
    return [emitTypeAliasDeclarationEntry(statement, sourceFile, printer)];
  }

  if (ts.isEnumDeclaration(statement)) {
    return [emitEnumDeclarationEntry(statement, sourceFile, printer)];
  }

  if (ts.isModuleDeclaration(statement)) {
    return [emitModuleDeclarationEntry(statement, sourceFile, printer)];
  }

  return [];
}

function isDeclareGlobalStatement(
  statement: ts.Statement
): statement is ts.ModuleDeclaration {
  return (
    ts.isModuleDeclaration(statement) &&
    ts.isIdentifier(statement.name) &&
    statement.name.text === "global"
  );
}

function hasExportModifier(node: ts.Statement): boolean {
  return (
    ts.canHaveModifiers(node) &&
    ts
      .getModifiers(node)
      ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) === true
  );
}

function emitVariableDeclarationEntries(
  statement: ts.VariableStatement,
  sourceFile: ts.SourceFile,
  printer: ts.Printer
): DeclarationEntry[] {
  const results: DeclarationEntry[] = [];

  for (const decl of statement.declarationList.declarations) {
    const name = decl.name.getText(sourceFile);
    const typeNode = decl.type;

    const typeText = typeNode
      ? printer.printNode(ts.EmitHint.Unspecified, typeNode, sourceFile)
      : "any";

    results.push({
      suppressKey: `variable:${name}`,
      text: `export declare const ${name}: ${typeText};`,
    });
  }

  return results;
}

function emitFunctionDeclarationEntry(
  statement: ts.FunctionDeclaration,
  sourceFile: ts.SourceFile,
  printer: ts.Printer
): DeclarationEntry | null {
  const name = statement.name?.getText(sourceFile);

  if (!name) {
    return null;
  }

  const typeParams = statement.typeParameters
    ? `<${statement.typeParameters.map((tp) => printer.printNode(ts.EmitHint.Unspecified, tp, sourceFile)).join(", ")}>`
    : "";

  const params = statement.parameters
    .map((p) => printer.printNode(ts.EmitHint.Unspecified, p, sourceFile))
    .join(", ");

  const returnType = statement.type
    ? printer.printNode(ts.EmitHint.Unspecified, statement.type, sourceFile)
    : "any";

  return {
    suppressKey: `function:${name}`,
    text: `export declare function ${name}${typeParams}(${params}): ${returnType};`,
  };
}

function emitClassDeclarationEntry(
  statement: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
  printer: ts.Printer
): DeclarationEntry | null {
  const name = statement.name?.getText(sourceFile);

  if (!name) {
    return null;
  }

  const typeParams = statement.typeParameters
    ? `<${statement.typeParameters.map((tp) => printer.printNode(ts.EmitHint.Unspecified, tp, sourceFile)).join(", ")}>`
    : "";

  const heritageClauses = statement.heritageClauses
    ? " " +
      statement.heritageClauses.map((hc) => hc.getText(sourceFile)).join(" ")
    : "";

  const members: string[] = [];

  for (const member of statement.members) {
    if (ts.isConstructorDeclaration(member)) {
      const params = member.parameters
        .map((p) => printer.printNode(ts.EmitHint.Unspecified, p, sourceFile))
        .join(", ");
      members.push(`  constructor(${params});`);
    } else if (ts.isMethodDeclaration(member)) {
      const memberName = member.name.getText(sourceFile);
      const mTypeParams = member.typeParameters
        ? `<${member.typeParameters.map((tp) => printer.printNode(ts.EmitHint.Unspecified, tp, sourceFile)).join(", ")}>`
        : "";
      const params = member.parameters
        .map((p) => printer.printNode(ts.EmitHint.Unspecified, p, sourceFile))
        .join(", ");
      const returnType = member.type
        ? printer.printNode(ts.EmitHint.Unspecified, member.type, sourceFile)
        : "any";
      members.push(`  ${memberName}${mTypeParams}(${params}): ${returnType};`);
    } else if (ts.isPropertyDeclaration(member)) {
      const memberName = member.name.getText(sourceFile);
      const type = member.type
        ? printer.printNode(ts.EmitHint.Unspecified, member.type, sourceFile)
        : "any";
      members.push(`  ${memberName}: ${type};`);
    }
  }

  return {
    suppressKey: `class:${name}`,
    text: `export declare class ${name}${typeParams}${heritageClauses} {\n${members.join("\n")}\n}`,
  };
}

function emitInterfaceDeclarationEntry(
  statement: ts.InterfaceDeclaration,
  sourceFile: ts.SourceFile,
  printer: ts.Printer
): DeclarationEntry {
  return {
    suppressKey: `interface:${statement.name.getText(sourceFile)}`,
    text: prefixExport(
      printer.printNode(ts.EmitHint.Unspecified, statement, sourceFile)
    ),
  };
}

function emitTypeAliasDeclarationEntry(
  statement: ts.TypeAliasDeclaration,
  sourceFile: ts.SourceFile,
  printer: ts.Printer
): DeclarationEntry {
  return {
    suppressKey: `type:${statement.name.getText(sourceFile)}`,
    text: prefixExport(
      printer.printNode(ts.EmitHint.Unspecified, statement, sourceFile)
    ),
  };
}

function emitEnumDeclarationEntry(
  statement: ts.EnumDeclaration,
  sourceFile: ts.SourceFile,
  printer: ts.Printer
): DeclarationEntry {
  return {
    suppressKey: `enum:${statement.name.getText(sourceFile)}`,
    text: prefixExport(
      printer.printNode(ts.EmitHint.Unspecified, statement, sourceFile)
    ),
  };
}

function emitModuleDeclarationEntry(
  statement: ts.ModuleDeclaration,
  sourceFile: ts.SourceFile,
  printer: ts.Printer
): DeclarationEntry {
  return {
    suppressKey: `namespace:${statement.name.getText(sourceFile)}`,
    text: prefixExport(
      printer.printNode(ts.EmitHint.Unspecified, statement, sourceFile)
    ),
  };
}

function prefixExport(text: string): string {
  return text.startsWith("export ") ? text : `export ${text}`;
}
