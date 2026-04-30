export interface CompiledJavascriptTransformOptions {
  shared?: boolean;
  moduleName?: string;
  sharedScripts?: string[];
}

export function wrapSharedScriptForInjection(
  moduleName: string,
  compiledJs: string
): string {
  let code = compiledJs;
  const exportedNames: string[] = [];

  code = code.replace(
    /^export\s+(const|let|var)\s+(\w+)/gm,
    (_match, decl, varName) => {
      exportedNames.push(varName);
      return `${decl} ${varName}`;
    }
  );

  code = code.replace(/^export\s+function\s+(\w+)/gm, (_match, fnName) => {
    exportedNames.push(fnName);
    return `function ${fnName}`;
  });

  code = code.replace(/^export\s+class\s+(\w+)/gm, (_match, className) => {
    exportedNames.push(className);
    return `class ${className}`;
  });

  code = code.replace(/^export\s+default\s+/gm, () => {
    exportedNames.push("default");
    return "const __default__ = ";
  });

  code = code.replace(/^export\s*\{([^}]+)\}\s*;?/gm, (_match, names) => {
    const nameList = (names as string)
      .split(",")
      .map((name: string) => {
        const parts = name.trim().split(/\s+as\s+/);
        return parts[parts.length - 1].trim();
      })
      .filter(Boolean);

    exportedNames.push(...nameList);
    return "";
  });

  const assignments = exportedNames
    .map((name) =>
      name === "default"
        ? '__ns__["default"]=__default__'
        : `__ns__[${JSON.stringify(name)}]=${name}`
    )
    .join(";");

  return [
    "(function(){",
    "window.__INVERT_SHARED__=window.__INVERT_SHARED__||{};",
    "var __ns__={};",
    code,
    ";",
    assignments,
    ";",
    `window.__INVERT_SHARED__[${JSON.stringify(moduleName)}]=__ns__;`,
    "})();",
  ].join("");
}

export function resolveSharedImports(compiledJs: string): string {
  let code = compiledJs;

  code = code.replace(
    /^import\s*\{([^}]+)\}\s*from\s*["']shared\/([^"']+)["']\s*;?\s*$/gm,
    (_match, imports, modName) =>
      `const {${imports}} = window.__INVERT_SHARED__[${JSON.stringify(modName)}];`
  );

  code = code.replace(
    /^import\s+(\w+)\s+from\s*["']shared\/([^"']+)["']\s*;?\s*$/gm,
    (_match, importName, modName) =>
      `const ${importName} = window.__INVERT_SHARED__[${JSON.stringify(modName)}]["default"];`
  );

  code = code.replace(
    /^import\s*\*\s*as\s+(\w+)\s+from\s*["']shared\/([^"']+)["']\s*;?\s*$/gm,
    (_match, importName, modName) =>
      `const ${importName} = window.__INVERT_SHARED__[${JSON.stringify(modName)}];`
  );

  return code;
}

export function prepareCompiledJavascript(
  compiledJs: string,
  options: CompiledJavascriptTransformOptions
): string {
  let code = compiledJs;

  if (options.sharedScripts && options.sharedScripts.length > 0) {
    code = resolveSharedImports(code);
  }

  if (options.shared && options.moduleName) {
    code = wrapSharedScriptForInjection(options.moduleName, code);
  }

  return code;
}
