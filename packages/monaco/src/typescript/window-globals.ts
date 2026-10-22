/** Userscripts may attach page globals while DOM members keep their own types. */
export const userscriptWindowDeclarations = `interface Window {
  [property: string]: any;
}
`;
