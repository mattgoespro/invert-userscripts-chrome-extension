import CopyWebpackPlugin from 'copy-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import path from 'path';
import MonacoEditorWebpackPlugin from 'monaco-editor-webpack-plugin';
import type { Configuration } from 'webpack';
import { ChromeExtensionReloaderPlugin } from './tools/webpack-extension-reloader.ts';

export default {
  mode: 'development',
  devtool: 'cheap-module-source-map',
  entry: {
    background: './src/background/background.ts',
    popup: './src/popup/popup.tsx',
    options: './src/options/options.tsx',
    content: './src/content/content.ts',
  },
  output: {
    path: path.resolve(import.meta.dirname, 'dist'),
    filename: '[name].js',
    publicPath: '',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: { transpileOnly: true },
        },
        include: /src/,
        exclude: /node_modules/,
      },
      {
        test: /\.scss$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
        include: /src/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
        include: /src/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/popup/popup.html',
      filename: 'popup.html',
      chunks: ['popup'],
    }),
    new HtmlWebpackPlugin({
      template: './src/options/options.html',
      filename: 'options.html',
      chunks: ['options'],
    }),
    new MonacoEditorWebpackPlugin({
      languages: ['typescript', 'scss', 'javascript', 'css'],
      publicPath: '/',
    }),
    new ChromeExtensionReloaderPlugin({
      extensionDir: 'dist',
      // launch: true,
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'public',
          to: '.',
        },
      ],
    }),
  ],
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
        },
        monaco: {
          test: /[\\/]node_modules[\\/]monaco-editor[\\/]/,
          name: 'monaco',
          priority: 20,
        },
      },
    },
  },
} satisfies Configuration;
