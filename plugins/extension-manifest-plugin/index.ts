import fs from "node:fs";
import path from "node:path";
import webpack from "webpack";

interface ExtensionManifestPluginEntrypoints {
  optionsPage: string;
  background: string;
  popup: string;
}

interface ExtensionManifestPluginOptions {
  sourceManifestPath?: string;
  packageJsonPath?: string;
  outputFilename?: string;
  entrypoints?: Partial<ExtensionManifestPluginEntrypoints>;
}

interface ResolvedExtensionManifestPluginOptions {
  sourceManifestPath: string;
  packageJsonPath: string;
  outputFilename: string;
  entrypoints: ExtensionManifestPluginEntrypoints;
}

interface ExtensionManifestAction {
  default_popup?: string;
  [key: string]: unknown;
}

interface ExtensionManifestBackground {
  service_worker?: string;
  [key: string]: unknown;
}

interface ExtensionManifestOptionsUi {
  page?: string;
  [key: string]: unknown;
}

interface ExtensionManifest {
  $schema?: string;
  version?: string;
  description?: string;
  options_page?: string;
  options_ui?: ExtensionManifestOptionsUi;
  background?: ExtensionManifestBackground;
  action?: ExtensionManifestAction;
  [key: string]: unknown;
}

interface PackageJsonMetadata {
  version?: string;
  description?: string;
}

/**
 * A Webpack plugin that injects relevant information into the extension's manifest.json file, given a source manifest template.
 * This allows for dynamic generation of the manifest file based on the build configuration and environment variables.
 *
 * The plugin updates the following fields in the manifest:
 * - `version`: Set to the version specified in the package.json file.
 * - `description`: Set to the description specified in the package.json file.
 * - `options_page`: Set to the output path of the options page HTML file, if it exists in the build assets.
 * - `background.service_worker`: Set to the output path of the background script, if it exists in the build assets.
 * - `action.default_popup`: Set to the output path of the popup page HTML file, if it exists in the build assets.
 *
 * Configuration properties that reference asset paths (e.g., `options_page`, `background.service_worker`, `action.default_popup`) are resolved by matching the specified entry points in the Webpack configuration with the generated asset filenames. This ensures that the manifest references the correct output files,
 * even if their names include hashes or other dynamic components.
 *
 * If a `$schema` field is present in the source manifest template, it is removed from the generated manifest to ensure compatibility with the Chrome extension manifest schema.
 *
 * The plugin takes a source manifest template file (e.g., `src/manifest.template.json`) and generates the final `manifest.json` file in the output directory during the Webpack build process.
 */
export default class ExtensionManifestPlugin
  implements webpack.WebpackPluginInstance
{
  private readonly name = "ExtensionManifestPlugin";

  private readonly _options: ResolvedExtensionManifestPluginOptions;

  constructor(options: ExtensionManifestPluginOptions = {}) {
    this._options = {
      sourceManifestPath:
        options.sourceManifestPath ?? path.join("public", "manifest.json"),
      packageJsonPath: options.packageJsonPath ?? "package.json",
      outputFilename: options.outputFilename ?? "manifest.json",
      entrypoints: {
        optionsPage: options.entrypoints?.optionsPage ?? "options",
        background: options.entrypoints?.background ?? "background",
        popup: options.entrypoints?.popup ?? "popup",
      },
    };
  }

  apply(compiler: webpack.Compiler) {
    compiler.hooks.thisCompilation.tap(this.name, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: this.name,
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
        },
        () => {
          try {
            this.emitManifest(compilation, compiler.context);
          } catch (error) {
            compilation.errors.push(this.toWebpackError(error));
          }
        }
      );
    });
  }

  private emitManifest(
    compilation: webpack.Compilation,
    compilerContext: string
  ) {
    const manifest = this.readJsonFile<ExtensionManifest>(
      path.resolve(compilerContext, this._options.sourceManifestPath)
    );
    const packageJson = this.readJsonFile<PackageJsonMetadata>(
      path.resolve(compilerContext, this._options.packageJsonPath)
    );

    delete manifest.$schema;

    if (packageJson.version) {
      manifest.version = packageJson.version;
    }

    if (packageJson.description) {
      manifest.description = packageJson.description;
    }

    const optionsPageAsset = this.findHtmlAssetForEntrypoint(
      compilation,
      this._options.entrypoints.optionsPage
    );

    if (optionsPageAsset) {
      manifest.options_page = optionsPageAsset;

      if (manifest.options_ui) {
        manifest.options_ui = {
          ...manifest.options_ui,
          page: optionsPageAsset,
        };
      }
    }

    const backgroundAsset = this.findScriptAssetForEntrypoint(
      compilation,
      this._options.entrypoints.background
    );

    if (backgroundAsset) {
      manifest.background = {
        ...(manifest.background ?? {}),
        service_worker: backgroundAsset,
      };
    }

    const popupAsset = this.findHtmlAssetForEntrypoint(
      compilation,
      this._options.entrypoints.popup
    );

    if (popupAsset) {
      manifest.action = {
        ...(manifest.action ?? {}),
        default_popup: popupAsset,
      };
    }

    const output = `${JSON.stringify(manifest, null, 2)}\n`;
    const source = new webpack.sources.RawSource(output);

    if (compilation.getAsset(this._options.outputFilename)) {
      compilation.updateAsset(this._options.outputFilename, source);
      return;
    }

    compilation.emitAsset(this._options.outputFilename, source);
  }

  private findHtmlAssetForEntrypoint(
    compilation: webpack.Compilation,
    entrypointName: string
  ) {
    const scriptAsset = this.findScriptAssetForEntrypoint(
      compilation,
      entrypointName
    );

    if (!scriptAsset) {
      return undefined;
    }

    for (const asset of compilation.getAssets()) {
      if (!asset.name.endsWith(".html")) {
        continue;
      }

      if (asset.source.source().toString().includes(scriptAsset)) {
        return asset.name;
      }
    }

    return undefined;
  }

  private findScriptAssetForEntrypoint(
    compilation: webpack.Compilation,
    entrypointName: string
  ) {
    const chunk = compilation.namedChunks.get(entrypointName);

    if (!chunk) {
      return undefined;
    }

    for (const fileName of chunk.files) {
      if (fileName.endsWith(".js")) {
        return fileName;
      }
    }

    return undefined;
  }

  private readJsonFile<T>(filePath: string) {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  }

  private toWebpackError(error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown manifest generation error.";

    return new webpack.WebpackError(`${this.name}: ${message}`);
  }
}
