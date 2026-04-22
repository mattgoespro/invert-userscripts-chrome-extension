declare global {
  /**
   * Options for formatting JSON objects.
   *
   * @property { (key: string) => string } [objectKeyModifier] - A function to modify object keys.
   * @property { (value: unknown) => string } [objectValueModifier] - A function to modify object values.
   * @property { boolean } [sortObjectKeys] - Whether to sort object keys.
   * @property { boolean } [quoteStrings] - Whether to quote string values.
   */
  type PrettyStringifyOptions = {
    objectKeyModifier?: (key: string) => string;
    objectValueModifier?: (value: unknown) => string;
    sortObjectKeys?: boolean;
    quoteStrings?: boolean;
  };

  function prettyStringify(
    value: unknown,
    options?: PrettyStringifyOptions,
    indent?: number
  ): string;
}

export {};
