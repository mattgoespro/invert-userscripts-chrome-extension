# Feature and Bug Tracking TODOs

## Features

### **Script Editor**

- ~~Implement the `runAt` field for userscripts to allow users to specify when their userscript should be injected during a page's lifecycle.~~

### **Code Editor**

- **Implement shared userscript intellisense** to allow users to import and use shared userscripts with type safety and autocompletion support.
- **Implement global modules intellisense**, allowing users to import and use external libraries with type safety and autocompletion support.
  - Type-definitions for user-imported global modules can be sourced from [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) or generated automatically from the imported module's API.

## Performance

- Identify and reduce redundant dispatches of _Redux_ state actions.
- Investigate and optimize the performance of the code editor, especially in regards to:
  - Syntax highlighting
  - Handling large userscripts
  - Managing multiple imported shared scripts
  - Shared module declarations briefly highlighting as errors until the type-checking process completes

## Bundling

- Look at creating a manifest generator webpack plugin to mitigate dealing with keeping the package.json, source manifest.json, and JavaScript output paths aligned
- Investigate output bundles and their file sizes for further chunk-splitting optimizations.

## Bugs

_None logged yet._
