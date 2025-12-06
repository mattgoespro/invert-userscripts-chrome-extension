import CopyWebpackPlugin from 'copy-webpack-plugin';
import FaviconsWebpackPlugin from 'favicons-webpack-plugin';
import fs from 'fs-extra';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import path from 'path';
import TerserPlugin from 'terser-webpack-plugin';
import TsConfigPathsWebpackPlugin from 'tsconfig-paths-webpack-plugin';
import type { Configuration } from 'webpack';
import { ChromeExtensionReloaderWebpackPlugin } from './tools/chrome-extension-reloader-webpack-plugin.ts';

const __dirname = import.meta.dirname;

export default (_args: Record<string, any>, { mode }: { mode: 'development' | 'production' }) => {
  const reloaderPlugin =
    mode === 'development'
      ? new ChromeExtensionReloaderWebpackPlugin({
          launchBrowser: true,
          verbose: true,
          timeoutMs: 2000,
        })
      : undefined;

  return {
    mode,
    devtool: mode === 'production' ? false : 'inline-source-map',
    entry: {
      background: {
        import: './packages/runtime/src/background.ts',
        filename: 'background.js',
      },
      popup: { import: './packages/renderer/src/popup/index.tsx', filename: 'popup.js' },
      options: { import: './packages/renderer/src/options/index.tsx', filename: 'options.js' },
      'monaco/json.worker': 'monaco-editor/esm/vs/language/json/json.worker',
      'monaco/css.worker': 'monaco-editor/esm/vs/language/css/css.worker',
      'monaco/html.worker': 'monaco-editor/esm/vs/language/html/html.worker',
      'monaco/ts.worker': 'monaco-editor/esm/vs/language/typescript/ts.worker',
      'monaco/editor.worker': 'monaco-editor/esm/vs/editor/editor.worker',
    },
    stats: 'errors-warnings',
    output: {
      path: path.join(__dirname, 'dist'),
      filename: '[name].js',
      chunkFilename: 'chunks/[name].js',
      publicPath: '/',
      clean: mode === 'production',
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: 'ts-loader',
            options: {
              configFile: path.join(__dirname, 'packages', 'shared', 'tsconfig.json'),
              transpileOnly: true,
            },
          },
          include: /packages\/shared\/src/,
          exclude: /node_modules/,
        },
        {
          test: /\.ts$/,
          use: {
            loader: 'ts-loader',
            options: {
              configFile: path.join(__dirname, 'packages', 'runtime', 'tsconfig.json'),
              transpileOnly: true,
            },
          },
          include: /packages/,
          exclude: /node_modules/,
        },
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              configFile: path.join(__dirname, 'packages', 'renderer', 'tsconfig.json'),
              transpileOnly: true,
            },
          },
          include: /packages/,
          exclude: /node_modules/,
        },
        {
          test: /\.scss$/,
          include: path.resolve(__dirname, 'packages/renderer/src'),
          use: [
            'style-loader',
            'css-loader',
            'postcss-loader', // applies tailwind + autoprefixer,
            'sass-loader',
          ],
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          // For monaco editor
          test: /\.ttf$/,
          type: 'asset/resource',
          generator: {
            filename: 'assets/[name][ext]',
          },
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.scss'],
      alias: {
        '~': path.resolve(__dirname, 'packages/renderer/src/assets/'),
      },
      plugins: [
        new TsConfigPathsWebpackPlugin({
          configFile: path.join(__dirname, 'tsconfig.base.json'),
          references: [
            './packages/shared/tsconfig.json',
            './packages/runtime/tsconfig.json',
            './packages/renderer/tsconfig.json',
          ],
        }),
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './packages/renderer/src/popup/index.html',
        filename: 'popup.html',
        chunks: ['popup'],
      }),
      new HtmlWebpackPlugin({
        template: './packages/renderer/src/options/index.html',
        filename: 'options.html',
        chunks: ['options'],
      }),
      // new MonacoEditorWebpackPlugin({
      //   languages: ['typescript', 'scss', 'javascript', 'css'],
      //   filename: `monaco/[name].worker.js`,
      //   monacoEditorPath: path.join(__dirname, 'node_modules', 'monaco-editor'),
      // }),
      new FaviconsWebpackPlugin({
        logo: path.resolve(__dirname, 'public', 'assets', 'icon.png'),
        mode: 'webapp',
        cache: false,
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
      ...(reloaderPlugin ? [reloaderPlugin] : []),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.join(__dirname, 'public', 'manifest.json'),
            to: path.join(__dirname, 'dist'),
            transform: (content) => {
              const manifest: chrome.runtime.ManifestV3 = JSON.parse(content.toString());

              delete manifest.$schema;

              if (reloaderPlugin) {
                manifest.key = reloaderPlugin.manifestKey;
              }

              return JSON.stringify(manifest, null, 2);
            },
          },
        ],
      }),
    ],
    optimization:
      mode === 'production'
        ? {
            minimize: true,
            minimizer: [
              new TerserPlugin({
                extractComments: false,
              }),
            ],
            splitChunks: {
              cacheGroups: {
                defaultVendors: false,
                vendors: {
                  test: /[\\/]node_modules[\\/]/,
                  name: 'vendors',
                  chunks: (chunk) => ['popup', 'options', 'background'].includes(chunk.name ?? ''),
                  priority: -10,
                  enforce: true,
                },
                monacoEditor: {
                  test: /[\\/]node_modules[\\/]monaco-editor[\\/]/,
                  name: 'monaco/editor.lib',
                  chunks: (chunk) => ['popup', 'options'].includes(chunk.name ?? ''),
                  priority: 20,
                  enforce: true,
                },
              },
            },
          }
        : undefined,
    cache: true,
  } satisfies Configuration;
};
