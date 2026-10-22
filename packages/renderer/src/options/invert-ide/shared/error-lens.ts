import * as monaco from "monaco-editor";

interface ErrorLensMessage extends monaco.editor.IContentWidget {
  position: monaco.IPosition;
  node: HTMLSpanElement;
}

/** Render diagnostics in the view without changing the source or its undo stack. */
export function attachErrorLens(
  editor: monaco.editor.IStandaloneCodeEditor
): monaco.IDisposable {
  const decorations = editor.createDecorationsCollection();
  const messagesByLine = new Map<number, ErrorLensMessage>();
  let pendingFrame: number | undefined;

  const removeMessages = (): void => {
    for (const message of messagesByLine.values()) {
      editor.removeContentWidget(message);
    }
    messagesByLine.clear();
  };

  const createMessage = (line: number): ErrorLensMessage => {
    const container = document.createElement("div");
    const node = document.createElement("span");
    container.appendChild(node);
    const message: ErrorLensMessage = {
      position: { lineNumber: line, column: 1 },
      node,
      suppressMouseDown: true,
      getId: () => `${editor.getId()}.error-lens.${line}`,
      getDomNode: () => container,
      getPosition: () => ({
        position: message.position,
        preference: [monaco.editor.ContentWidgetPositionPreference.EXACT],
      }),
      beforeRender: () => {
        const anchor = editor.getScrolledVisiblePosition(message.position);
        const layout = editor.getLayoutInfo();
        // A content widget stays outside text layout. Restrict its width to the
        // remaining viewport so it never wraps the code or covers another pane.
        container.style.width = `${anchor ? Math.max(0, layout.contentLeft + layout.contentWidth - anchor.left - 8) : 0}px`;
        editor.applyFontInfo(node);
        return null;
      },
    };
    return message;
  };

  const layoutMessages = (): void => {
    for (const message of messagesByLine.values()) {
      editor.layoutContentWidget(message);
    }
  };

  const update = (): void => {
    const model = editor.getModel();
    if (!model || model.isDisposed()) {
      decorations.clear();
      removeMessages();
      return;
    }

    const markersByLine = new Map<number, monaco.editor.IMarker[]>();
    for (const marker of monaco.editor.getModelMarkers({
      resource: model.uri,
    })) {
      const line = marker.startLineNumber;
      if (line < 1 || line > model.getLineCount() || !marker.message.trim()) {
        continue;
      }
      const markers = markersByLine.get(line) ?? [];
      markers.push(marker);
      markersByLine.set(line, markers);
    }

    const next: monaco.editor.IModelDeltaDecoration[] = [];
    for (const [line, markers] of markersByLine) {
      // Errors take priority when a line has several problems. Hint/Info markers
      // are warnings in the Problems panel, including their promoted duplicates.
      markers.sort(
        (left, right) =>
          right.severity - left.severity || left.startColumn - right.startColumn
      );
      const severity =
        markers[0].severity === monaco.MarkerSeverity.Error
          ? "error"
          : "warning";
      const messages = [
        ...new Set(
          markers.map((marker) => marker.message.replace(/\s+/g, " ").trim())
        ),
      ];
      const summary =
        messages[0] +
        (messages.length > 1 ? ` (+${messages.length - 1} more)` : "");
      const hoverMessage = messages.map((message) => ({
        // Diagnostic text can contain Markdown punctuation or source snippets.
        value: message.replace(/[\\`*_{}\[\]()<>#+.!|~-]/g, "\\$&"),
        isTrusted: false,
      }));
      const endColumn = model.getLineMaxColumn(line);

      next.push({
        range: new monaco.Range(line, 1, line, endColumn),
        options: {
          isWholeLine: true,
          className: `error-lens-line-${severity}`,
          linesDecorationsClassName: `error-lens-gutter error-lens-${severity}`,
          linesDecorationsTooltip: messages.join("\n"),
          hoverMessage,
        },
      });
      const existing = messagesByLine.get(line);
      const message = existing ?? createMessage(line);
      message.position = { lineNumber: line, column: endColumn };
      message.node.className = `error-lens-message error-lens-${severity}`;
      message.node.textContent = summary;
      message.node.title = messages.join("\n");
      if (!existing) {
        messagesByLine.set(line, message);
        editor.addContentWidget(message);
      }
      editor.layoutContentWidget(message);
    }
    for (const [line, message] of messagesByLine) {
      if (!markersByLine.has(line)) {
        editor.removeContentWidget(message);
        messagesByLine.delete(line);
      }
    }
    decorations.set(next);
  };

  // Coalesce language-service and hint-promotion events into one view update.
  const scheduleUpdate = (): void => {
    if (pendingFrame !== undefined) {
      return;
    }
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = undefined;
      update();
    });
  };
  const listeners = [
    monaco.editor.onDidChangeMarkers((resources) => {
      const model = editor.getModel();
      if (
        model &&
        resources.some((uri) => uri.toString() === model.uri.toString())
      ) {
        scheduleUpdate();
      }
    }),
    editor.onDidChangeModel(update),
    editor.onDidChangeModelContent(scheduleUpdate),
    editor.onDidLayoutChange(layoutMessages),
    editor.onDidScrollChange(layoutMessages),
    editor.onDidChangeConfiguration(layoutMessages),
  ];
  update();

  return {
    dispose(): void {
      if (pendingFrame !== undefined) {
        cancelAnimationFrame(pendingFrame);
      }
      for (const listener of listeners) {
        listener.dispose();
      }
      decorations.clear();
      removeMessages();
    },
  };
}
