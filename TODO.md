# Feature and Bug Tracking TODOs

## Features

### **Script Editor**

- Compilation:
  - Investigate output minimization (unusued members, whitespace, comments, etc) and whether we can add a setting to enable/disable it.

### **Code Editor**

## Performance

- Identify and reduce redundant dispatches of _Redux_ state actions.
- Investigate and optimize the performance of the code editor, especially in regards to:
  - Syntax highlighting
  - Handling large userscripts
  - Managing multiple imported shared scripts
  - Shared module declarations briefly highlighting as errors until the type-checking process completes

## Webpack Bundling

- Look at creating a manifest generator webpack plugin to mitigate dealing with keeping the _package.json_, source _manifest.json_, and JavaScript output paths aligned
- Investigate output bundles and their file sizes for further chunk-splitting and minimization optimizations.

## Bugs

_None logged yet._
