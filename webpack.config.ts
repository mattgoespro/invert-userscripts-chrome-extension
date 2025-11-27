import CopyWebpackPlugin from 'copy-webpack-plugin';
import FaviconsWebpackPlugin from 'favicons-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MonacoEditorWebpackPlugin from 'monaco-editor-webpack-plugin';
import path from 'path';
import TsConfigPathsWebpackPlugin from 'tsconfig-paths-webpack-plugin';
import type { Configuration } from 'webpack';
import { ChromeExtensionReloaderWebpackPlugin } from './tools/chrome-extension-reloader-webpack-plugin.ts';

const __dirname = import.meta.dirname;

const backgroundEntryFilename = `vertext-ide-service-worker.js`;

export default (args: Record<string, any>, { mode }: { mode: 'development' | 'production' }) =>
  ({
    mode,
    devtool: mode === 'production' ? false : 'inline-source-map',
    entry: {
      background: {
        import: './packages/runtime/src/background.ts',
        filename: backgroundEntryFilename,
      },
      popup: { import: './packages/renderer/src/popup/index.tsx', filename: 'popup.js' },
      options: { import: './packages/renderer/src/options/index.tsx', filename: 'options.js' },
    },
    stats: 'errors-warnings',
    output: {
      path: path.join(__dirname, 'dist'),
      filename: '[name].js',
      clean: true,
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
          use: ['style-loader', 'css-loader', 'sass-loader'],
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /node_modules\/monaco-editor\/esm\/vs/,
          type: 'javascript/auto',
          generator: {
            filename: 'monaco/[path][name][ext]',
          },
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.scss'],
      alias: {
        'monaco-editor': 'monaco-editor/esm/vs/editor/editor.api',
        '~': path.resolve(__dirname, 'packages/renderer/src/assets/'),
      },
      plugins: [
        new TsConfigPathsWebpackPlugin({
          configFile: path.join(__dirname, 'tsconfig.base.json'),
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
      new MonacoEditorWebpackPlugin({
        languages: ['javascript', 'typescript', 'css', 'html', 'json'],
        filename: 'monaco/[name].worker.js',
        globalAPI: true,
        monacoEditorPath: path.join(__dirname, 'node_modules', 'monaco-editor'),
        publicPath: '',
      }),
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
      mode === 'development' &&
        new ChromeExtensionReloaderWebpackPlugin({
          extensionDir: 'dist',
          backgroundScriptEntryId: backgroundEntryFilename,
          launch: true,
          verbose: true,
        }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.join(import.meta.dirname, 'public', 'manifest.json'),
            to: path.join(import.meta.dirname, 'dist'),
            transform: (content) => {
              const manifest = JSON.parse(content.toString());

              manifest.background.service_worker = backgroundEntryFilename;
              delete manifest.$schema;

              return JSON.stringify(manifest, null, 2);
            },
          },
        ],
      }),
    ],
  }) satisfies Configuration;
