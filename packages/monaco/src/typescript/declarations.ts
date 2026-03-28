import ts from "typescript";

/**
 * Generates a TypeScript ambient module declaration from shared script source code.
 * Uses the TypeScript compiler API to parse the AST and extract all exported members,
 * producing `.d.ts`-style declarations that Monaco's TypeScript language service can
 * consume for `import { ... } from "shared/moduleName"` intellisense.
 */
export function generateSharedScriptDeclaration(
  _moduleName: string,
  sourceCode: string
): string {
  const sourceFile = ts.createSourceFile(
    "source.ts",
    sourceCode,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.TS
  );

  const lines: string[] = [];
  const printer = ts.createPrinter({ removeComments: true });

  for (const statement of sourceFile.statements) {
    if (!hasExportModifier(statement)) {
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      lines.push(emitVariableDeclaration(statement, sourceFile, printer));
    } else if (ts.isFunctionDeclaration(statement)) {
      lines.push(emitFunctionDeclaration(statement, sourceFile, printer));
    } else if (ts.isClassDeclaration(statement)) {
      lines.push(emitClassDeclaration(statement, sourceFile, printer));
    } else if (ts.isInterfaceDeclaration(statement)) {
      lines.push(emitInterfaceDeclaration(statement, sourceFile, printer));
    } else if (ts.isTypeAliasDeclaration(statement)) {
      lines.push(emitTypeAliasDeclaration(statement, sourceFile, printer));
    } else if (ts.isEnumDeclaration(statement)) {
      lines.push(emitEnumDeclaration(statement, sourceFile, printer));
    }
  }

  return lines.filter(Boolean).join("\n");
}

function hasExportModifier(node: ts.Statement): boolean {
  return (
    ts.canHaveModifiers(node) &&
    ts
      .getModifiers(node)
      ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) === true
  );
}

function emitVariableDeclaration(
  statement: ts.VariableStatement,
  sourceFile: ts.SourceFile,
  printer: ts.Printer
): string {
  const results: string[] = [];

  for (const decl of statement.declarationList.declarations) {
    const name = decl.name.getText(sourceFile);
    const typeNode = decl.type;

    if (typeNode) {
      const typeText = printer.printNode(
        ts.EmitHint.Unspecified,
        typeNode,
        sourceFile
      );
      results.push(`export declare const ${name}: ${typeText};`);
    } else {
      results.push(`export declare const ${name}: any;`);
    }
  }

  return results.join("\n");
}

function emitFunctionDeclaration(
  statement: ts.FunctionDeclaration,
  sourceFile: ts.SourceFile,
  printer: ts.Printer
): string {
  const name = statement.name?.getText(sourceFile) ?? "default";

  const typeParams = statement.typeParameters
    ? `<${statement.typeParameters.map((tp) => printer.printNode(ts.EmitHint.Unspecified, tp, sourceFile)).join(", ")}>`
    : "";

  const params = statement.parameters
    .map((p) => printer.printNode(ts.EmitHint.Unspecified, p, sourceFile))
    .join(", ");

  const returnType = statement.type
    ? printer.printNode(ts.EmitHint.Unspecified, statement.type, sourceFile)
    : "any";

  return `export declare function ${name}${typeParams}(${params}): ${returnType};`;
}

function emitClassDeclaration(
  statement: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
  printer: ts.Printer
): string {
  const name = statement.name?.getText(sourceFile) ?? "default";

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

  return `export declare class ${name}${typeParams}${heritageClauses} {\n${members.join("\n")}\n}`;
}

function emitInterfaceDeclaration(
  statement: ts.InterfaceDeclaration,
  sourceFile: ts.SourceFile,
  printer: ts.Printer
): string {
  return printer.printNode(ts.EmitHint.Unspecified, statement, sourceFile);
}

function emitTypeAliasDeclaration(
  statement: ts.TypeAliasDeclaration,
  sourceFile: ts.SourceFile,
  printer: ts.Printer
): string {
  return printer.printNode(ts.EmitHint.Unspecified, statement, sourceFile);
}

function emitEnumDeclaration(
  statement: ts.EnumDeclaration,
  sourceFile: ts.SourceFile,
  printer: ts.Printer
): string {
  return printer.printNode(ts.EmitHint.Unspecified, statement, sourceFile);
}
