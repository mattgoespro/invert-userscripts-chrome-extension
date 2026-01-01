import CopyWebpackPlugin from "copy-webpack-plugin";
import FaviconsWebpackPlugin from "favicons-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import path from "path";
import TerserPlugin from "terser-webpack-plugin";
import webpack from "webpack";
import { ChromeExtensionReloaderWebpackPlugin } from "./tools/chrome-extension-reloader-webpack-plugin.ts";
import MonacoEditorWebpackPlugin from "monaco-editor-webpack-plugin";
import packageJson from "./package.json" with { type: "json" };

const __dirname = import.meta.dirname;

export default (_args: unknown, { mode }: { mode: "development" | "production" }) =>
  ({
    mode,
    devtool: mode === "production" ? false : "inline-source-map",
    entry: {
      background: {
        import: "./packages/runtime/src/background.ts",
        filename: "background.js",
      },
      popup: { import: "./packages/renderer/src/popup/index.tsx", filename: "popup.js" },
      options: { import: "./packages/renderer/src/options/index.tsx", filename: "options.js" },
    },
    stats: "errors-warnings",
    output: {
      path: path.join(__dirname, "dist"),
      filename: "[name].js",
      chunkFilename: (pathData) => {
        const chunk = pathData.chunk;

        // Check by module path (production)
        if (
          chunk instanceof webpack.Chunk &&
          chunk.modulesIterable &&
          Array.from(chunk.modulesIterable).some((m) =>
            m.identifier().includes(path.join("node_modules", "monaco-editor"))
          )
        ) {
          return "monaco-editor/[chunkhash].js";
        }

        return "chunks/[chunkhash].js";
      },
      publicPath: "/",
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: "esbuild-loader",
            options: {
              tsconfig: path.join(__dirname, "packages", "shared", "tsconfig.json"),
            },
          },
          include: /packages\/shared\/src/,
          exclude: /node_modules/,
        },
        {
          test: /\.ts$/,
          use: {
            loader: "esbuild-loader",
            options: {
              tsconfig: path.join(__dirname, "packages", "runtime", "tsconfig.json"),
            },
          },
          include: /packages/,
          exclude: /node_modules/,
        },
        {
          test: /\.tsx?$/,
          use: {
            loader: "ts-loader",
            options: {
              configFile: path.join(__dirname, "packages", "renderer", "tsconfig.json"),
              transpileOnly: true,
            },
          },
          include: /packages/,
          exclude: /node_modules/,
        },
        {
          test: /\.scss$/,
          use: ["style-loader", "css-loader", "sass-loader"],
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
        {
          // Fonts bundled with monaco-editor
          test: /\.ttf$/,
          type: "asset/resource",
          generator: {
            filename: "assets/fonts/[name][ext]",
          },
        },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js", ".scss", ".css"],
      alias: {
        "~/theme": path.resolve(__dirname, "packages/renderer/src/assets/styles/theme.scss"),
        "@": path.resolve(__dirname, "packages/renderer/src/"),
        "@shared": path.resolve(__dirname, "packages/shared/src/"),
        "monaco-editor": "monaco-editor/esm/vs/editor/editor.api.js",
      },
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "./packages/renderer/src/popup/index.html",
        filename: "popup.html",
        chunks: ["popup"],
      }),
      new HtmlWebpackPlugin({
        template: "./packages/renderer/src/options/index.html",
        filename: "options.html",
        chunks: ["options"],
      }),
      new MonacoEditorWebpackPlugin({
        languages: ["typescript", "scss", "javascript", "css"],
        filename: "monaco-editor/workers/[name].worker.js",
        monacoEditorPath: path.resolve(__dirname, "node_modules/monaco-editor"),
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.join(__dirname, "public", "manifest.json"),
            to: path.join(__dirname, "dist"),
            transform: (content) => {
              const manifest: chrome.runtime.ManifestV3 = JSON.parse(content.toString());

              delete manifest.$schema;
              manifest.description = packageJson.description;

              return JSON.stringify(manifest);
            },
          },
        ],
      }),
      new FaviconsWebpackPlugin({
        logo: path.resolve(__dirname, "public", "assets", "icon.png"),
        mode: "webapp",
        cache: false,
        outputPath: "assets/favicons",
        favicons: {
          icons: {
            android: false,
            appleIcon: false,
            appleStartup: false,
            windows: false,
            yandex: false,
            favicons: true,
          },
        },
      }),
      mode === "development" ? new ChromeExtensionReloaderWebpackPlugin() : false,
    ],
    optimization:
      mode === "production"
        ? {
            minimize: true,
            minimizer: [
              new TerserPlugin({
                extractComments: false,
              }),
            ],
          }
        : undefined,
    cache: true,
  }) satisfies webpack.Configuration;
