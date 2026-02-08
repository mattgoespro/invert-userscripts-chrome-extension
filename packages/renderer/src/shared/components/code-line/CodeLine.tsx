import "./CodeLine.scss";

type TokenType =
  | "keyword"
  | "type"
  | "function-name"
  | "string"
  | "punctuation"
  | "identifier"
  | "comment"
  | "whitespace";

type Token = {
  type: TokenType;
  value: string;
};

const KEYWORDS = new Set([
  "import",
  "export",
  "from",
  "const",
  "let",
  "var",
  "function",
  "class",
  "return",
  "new",
  "async",
  "await",
  "default",
  "if",
  "else",
  "extends",
  "implements",
  "interface",
  "type",
]);

const TYPE_KEYWORDS = new Set([
  "void",
  "string",
  "number",
  "boolean",
  "any",
  "never",
  "unknown",
  "null",
  "undefined",
  "true",
  "false",
]);

function classifyWord(word: string): TokenType {
  if (KEYWORDS.has(word)) return "keyword";
  if (TYPE_KEYWORDS.has(word)) return "type";
  if (/^[A-Z]/.test(word)) return "type";
  return "identifier";
}

function tokenize(code: string): Token[] {
  const regex =
    /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`|\/\/[^\n]*|\s+|=>|[{}()\[\]<>:;,.=!?@#%^&*~|+\-/\\]|[a-zA-Z_$][\w$]*|\d+(?:\.\d+)?|./g;
  const tokens: Token[] = [];
  let match;

  while ((match = regex.exec(code)) !== null) {
    const value = match[0];

    if (value.startsWith("'") || value.startsWith('"') || value.startsWith("`")) {
      tokens.push({ type: "string", value });
    } else if (value.startsWith("//")) {
      tokens.push({ type: "comment", value });
    } else if (/^\s+$/.test(value)) {
      tokens.push({ type: "whitespace", value });
    } else if (/^\d/.test(value)) {
      tokens.push({ type: "identifier", value });
    } else if (/^[^a-zA-Z0-9_$]+$/.test(value)) {
      tokens.push({ type: "punctuation", value });
    } else {
      const lastSignificant = tokens.findLast((t) => t.type !== "whitespace");
      if (lastSignificant?.value === "function") {
        tokens.push({ type: "function-name", value });
      } else {
        tokens.push({ type: classifyWord(value), value });
      }
    }
  }

  return tokens;
}

type CodeLineProps = {
  code: string;
} & React.HTMLAttributes<HTMLElement>;

export function CodeLine({ code, className, ...rest }: CodeLineProps) {
  const tokens = tokenize(code);

  return (
    <code className={`code-line${className ? ` ${className}` : ""}`} {...rest}>
      {tokens.map((token, index) => (
        <span key={index} className={`code-line--${token.type}`}>
          {token.value}
        </span>
      ))}
    </code>
  );
}
