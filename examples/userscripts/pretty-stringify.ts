/**
 * Converts a given value to a pretty-printed string representation.
 *
 * @param value - The value to be pretty-printed. Can be of any type.
 * @param options - Optional formatting options for JSON strings.
 * @param indent - The number of spaces to use for indentation. Default is 0.
 * @returns The pretty-printed string representation of the value.
 * @throws Will throw an error if the value type is unsupported.
 */
function prettyStringify(
  value: unknown,
  options: PrettyStringifyOptions,
  indent = 0
): string {
  if (value == null) {
    return "null";
  }

  switch (typeof value) {
    case "undefined":
      return "undefined";
    case "string":
      return options?.quoteStrings ? `"${value}"` : value;
    case "boolean":
    case "number":
    case "function":
      return value.toString();
    case "object":
      if (value === null) {
        return "null";
      }

      if (Array.isArray(value)) {
        if (value.length === 0) {
          return "[]";
        }

        return formatArray(value, options, indent);
      }

      if (Object.keys(value).length === 0) {
        return "{}";
      }

      return formatObject(value as Record<string, unknown>, options, indent);
    default:
      throw new Error(`Unsupported object type: ${typeof value}`);
  }
}
/**
 * Formats an array of objects into a pretty-printed JSON string with specified indentation.
 *
 * @param array - The array of objects to format.
 * @param options - Optional formatting options for JSON stringification.
 * @param indent - The number of spaces to use for indentation.
 * @returns The formatted JSON string representation of the array.
 */
function formatArray(
  array: object[],
  options: PrettyStringifyOptions,
  indent: number
): string {
  const formattedArray = array
    .map(
      (value) =>
        `${" ".repeat(indent + 2)}${prettyStringify(value, options, indent + 2)}`
    )
    .join(`,\n`);
  return `[\n${formattedArray}\n${" ".repeat(indent)}]`;
}
/**
 * Formats a given object into a pretty-printed string representation.
 *
 * @param object - The object to format.
 * @param options - Optional formatting options.
 * @param indent - The number of spaces to use for indentation (default is 0).
 * @returns The formatted string representation of the object.
 */
function formatObject(
  object: Record<string, unknown>,
  options: PrettyStringifyOptions,
  indent = 0
): string {
  const keyModifier = options?.objectKeyModifier ?? ((key) => key);
  const valueModifier = options?.objectValueModifier ?? ((value) => `${value}`);

  const formattedObject = (
    options?.sortObjectKeys
      ? Object.entries(object).sort(([keyA], [keyB]) =>
          keyA.localeCompare(keyB)
        )
      : Object.entries(object)
  )
    .map(([key, value]) => {
      if (
        value == null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        return `${" ".repeat(indent + 2)}${keyModifier(key)}: ${valueModifier(value)}`;
      }

      return `${" ".repeat(indent + 2)}${keyModifier(key)}: ${prettyStringify(value, options, indent + 2)}`;
    })
    .join(`,\n`);
  return `{\n${formattedObject}\n${" ".repeat(indent)}}`;
}
