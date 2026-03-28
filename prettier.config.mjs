/** @type { import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions } */
export default {
  trailingComma: "es5",
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindStylesheet: "packages/renderer/src/assets/styles/tailwind.css",
  tailwindFunctions: ["clsx"],
};
