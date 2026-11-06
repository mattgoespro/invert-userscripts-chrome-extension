/** The integer a number field's text commits to, or null while it isn't valid. */
export function parseNumberSetting(
  text: string,
  min: number,
  max: number
): number | null {
  const value = text.trim() === "" ? NaN : Number(text);
  return Number.isInteger(value) && value >= min && value <= max ? value : null;
}
