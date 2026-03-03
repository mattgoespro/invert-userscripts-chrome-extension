# Outstanding Tasks

## Features

### Editor Experience

- Implement the `runAt` field for userscripts to allow users to specify when their userscript should be injected during a page's lifecycle.
- Implement shared and global module intellisense for userscripts to allow users to import and use shared and global modules in their userscripts with type safety and autocompletion support.
-

## Performance

- Look at reducing redundant redux state action dispatches where not necessary.

## Bugs

- Clicking on a sidebar nav button makes the button icon wiggle

## Bundling

- Look at creating a manifest generator webpack plugin to mitigate dealing with keeping the package.json, source manifest.json, and JavaScript output paths aligned
- Investigate output bundles and their file sizes for further chunk-splitting optimizations.
