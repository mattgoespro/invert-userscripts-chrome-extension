# Outstanding Tasks

## Features

### Editor Experience

- Implement the `runAt` field for userscripts to allow users to specify when their userscript should be injected during a page's lifecycle.

#### Intellisense

- Implement shared userscript intellisense to allow users to import and use shared userscripts with type safety and autocompletion support.
- Implement intellisense for user-imported global modules, allowing users to import and use external libraries with type safety and autocompletion support.
  - Type-definitions for user-imported global modules could be sourced from DefinitelyTyped or generated automatically based on the imported module's API.

## Performance

- Look at reducing redundant redux state action dispatches where not necessary.

## Bugs

- Clicking on a sidebar nav button makes the button icon wiggle

## Bundling

- Look at creating a manifest generator webpack plugin to mitigate dealing with keeping the package.json, source manifest.json, and JavaScript output paths aligned
- Investigate output bundles and their file sizes for further chunk-splitting optimizations.
