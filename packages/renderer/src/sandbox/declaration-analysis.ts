import * as ts from "typescript";

/**
 * Bind a declarations pane to its own main module, independently of exports.
 * This is a language-service extra lib, never source saved to the user's model.
 * Parsing stays in the existing build worker. Imports retain their original
 * directory and scope; declarations retain generics, comments and private peers.
 */
export function buildOwnDeclarations(source: string): string {
  const file = ts.createSourceFile(
    "types.d.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const imports: string[] = [];
  const declarations: string[] = [];
  const printer = ts.createPrinter();
  for (const statement of file.statements) {
    if (
      ts.isImportDeclaration(statement) ||
      ts.isImportEqualsDeclaration(statement)
    ) {
      imports.push(statement.getText(file));
      continue;
    }
    if (
      ts.isExportDeclaration(statement) ||
      ts.isExportAssignment(statement) ||
      (ts.isModuleDeclaration(statement) &&
        (ts.isStringLiteral(statement.name) ||
          (statement.flags & ts.NodeFlags.GlobalAugmentation) !== 0))
    ) {
      // Re-exports and explicit global/package augmentations are already
      // represented by the real types model; they are not local declarations.
      continue;
    }
    const transformed = ts.transform(statement, [
      (context) => (node) => {
        if (!ts.canHaveModifiers(node)) {
          return node;
        }
        return context.factory.replaceModifiers(
          node,
          ts
            .getModifiers(node)
            ?.filter(
              (modifier) =>
                modifier.kind !== ts.SyntaxKind.ExportKeyword &&
                modifier.kind !== ts.SyntaxKind.DefaultKeyword &&
                modifier.kind !== ts.SyntaxKind.DeclareKeyword
            )
        );
      },
    ]);
    declarations.push(
      printer.printNode(
        ts.EmitHint.Unspecified,
        transformed.transformed[0],
        file
      )
    );
    transformed.dispose();
  }
  if (declarations.length === 0) {
    return "";
  }
  return `${imports.join("\n")}\nexport {};\ndeclare module "./main" {\n${declarations.join("\n")}\n}\n`;
}
