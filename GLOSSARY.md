# Invert IDE

## Language

**Editor draft**: The editable TypeScript, SCSS, and type-definition buffers for a userscript, including unsaved changes.

**Draft save**: Saving an editor draft's buffers, optionally compiling and applying the userscript to matching tabs.

**Draft conflict**: An observed difference between unsaved editor draft changes and an externally saved userscript that requires a choice about which changes to keep.

**Conflict resolution**: Choosing which changes to keep for an observed draft conflict. A later conflict requires its own choice.

**Workspace projection**: The desired collection of userscript editor files and supporting package types for the current selection and draft contents.

**Storage reconciliation**: Comparing saved userscripts with editor drafts to incorporate external changes while preserving unsaved work or reporting conflicts.

**Compiled artifact**: JavaScript and CSS produced from a userscript's source, with freshness information identifying the source and compilation settings.

**Live output preview**: JavaScript and CSS built from the current editor draft for the output drawer, without saving its source or publishing a compiled artifact.

**Artifact publication**: Making a userscript's compiled artifact available alongside its saved source, so freshness checks can identify which source and compilation settings produced it.
