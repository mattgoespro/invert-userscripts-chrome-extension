import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import * as ts from "typescript";

test("JSX buttons use explicit native types and shared sizing presets", () => {
  const violations = [];
  const root = path.resolve("packages/renderer/src");
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(filename);
        continue;
      }
      if (!filename.endsWith(".tsx")) {
        continue;
      }
      const source = ts.createSourceFile(
        filename,
        fs.readFileSync(filename, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );
      const visit = (node) => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          const tag = node.tagName.getText(source);
          const attributes = node.attributes.properties.filter(
            ts.isJsxAttribute
          );
          const location = `${path.relative(root, filename)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
          if (
            tag === "button" &&
            !attributes.some(
              (attribute) => attribute.name.getText(source) === "type"
            )
          ) {
            violations.push(
              `${location}: native button needs an explicit type`
            );
          }
          if (tag === "Button" || tag === "IconButton") {
            const className = attributes.find(
              (attribute) => attribute.name.getText(source) === "className"
            );
            const visitClasses = (value) => {
              if (ts.isStringLiteral(value)) {
                const overrides = value.text
                  .split(/\s+/)
                  .filter((token) =>
                    /^(?:h-|min-h-|max-h-|size-|p-|px-|py-|pt-|pb-|text-(?:xs|sm|base|lg|xl|\[))/.test(
                      token
                    )
                  );
                if (overrides.length) {
                  violations.push(
                    `${location}: use size preset instead of ${overrides.join(" ")}`
                  );
                }
              }
              ts.forEachChild(value, visitClasses);
            };
            if (className) {
              visitClasses(className);
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  };
  walk(root);
  assert.deepEqual(violations, []);
});
