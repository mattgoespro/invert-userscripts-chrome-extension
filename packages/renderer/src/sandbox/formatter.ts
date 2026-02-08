import prettier from "prettier/standalone";
import parserTypeScript from "prettier/plugins/typescript";
import parserPostCSS from "prettier/plugins/postcss";
import parserEstree from "prettier/plugins/estree";

export type FormatterLanguage = "typescript" | "scss";

export class PrettierFormatter {
  private static readonly languageToParser: Record<FormatterLanguage, string> = {
    typescript: "typescript",
    scss: "scss",
  };

  private static readonly plugins = [parserTypeScript, parserPostCSS, parserEstree];

  static async format(code: string, language: FormatterLanguage): Promise<string> {
    try {
      const parser = this.languageToParser[language];
      return await prettier.format(code, {
        parser,
        plugins: this.plugins,
        tabWidth: 2,
        useTabs: false,
        semi: true,
        singleQuote: false,
        trailingComma: "es5",
        printWidth: 100,
      });
    } catch (error) {
      console.error("Formatting error:", error);
      return code; // Return original code if formatting fails
    }
  }
}
