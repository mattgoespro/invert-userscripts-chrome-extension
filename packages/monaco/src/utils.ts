/**
 * Converts the given string from camel-case to kebab-case.
 * Handles uppercase boundaries and letter→digit transitions.
 *
 * @template S The string to convert the case.
 * @see https://gist.github.com/albertms10/09f14ef7ebdc3ce0e95683c728616253
 * @example
 * type A = CamelToKebabCase<'exampleVarName'>;
 * // 'example-var-name'
 * type B = CamelToKebabCase<'example123Number'>;
 * // 'example-123-number'
 */
export type CamelToKebabCase<S extends string> =
  S extends `${infer T}${infer U}`
    ? U extends `${number}${string}`
      ? T extends `${number}`
        ? `${T}${CamelToKebabCase<U>}`
        : `${Uncapitalize<T>}-${CamelToKebabCase<U>}`
      : U extends Uncapitalize<U>
        ? `${Uncapitalize<T>}${CamelToKebabCase<U>}`
        : `${Uncapitalize<T>}-${CamelToKebabCase<U>}`
    : "";
