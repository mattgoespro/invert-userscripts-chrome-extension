import { minify } from "terser";
export async function minifyUserscript(code: string): Promise<string> {
  const result = await minify(code, {
    // Negating an async IIFE discards its promise and races shared initialization.
    compress: { negate_iife: false },
    ecma: 2020,
    format: { comments: false },
    mangle: true,
  });
  return result.code ?? code;
}
