import { IconButton } from "@/shared/components/icon-button/IconButton";
import { ResizeHandle } from "@/shared/components/resize-handle/ResizeHandle";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { Typography } from "@/shared/components/typography/Typography";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import {
  selectAllUserscripts,
  selectCurrentUserscript,
} from "@/shared/store/slices/userscripts";
import { selectUserscript } from "@/shared/store/select-userscript";
import {
  buildUserscriptsTransferFile,
  stringifyUserscriptsTransferFile,
  UserscriptsTransferFile,
} from "@/shared/store/slices/userscripts/transfer.userscripts";
import { LoaderCircleIcon, PlusIcon, SearchIcon } from "lucide-react";
import clsx from "clsx";
import { groupScriptsBySite } from "@/shared/utils/script-site";
import { useCallback, useMemo, useState } from "react";
import { Group, Panel } from "react-resizable-panels";
import { ScriptEditor } from "./script-editor/ScriptEditor";
import { ScriptList } from "@/shared/components/script-list/ScriptList";
import {
  createUserscript,
  importUserscripts,
} from "@/shared/store/slices/userscripts/thunks.userscripts";
import {
  selectPanelSizes,
  selectScriptListSort,
  setScriptListSort,
  updatePanelSizesIfChanged,
} from "@/shared/store/slices/ui";
import { ImportUserscriptsDialog } from "./import-userscripts-dialog/ImportUserscriptsDialog";
import { ScriptsActionsMenu } from "./scripts-actions-menu/ScriptsActionsMenu";

type ScriptListFilter = "all" | "problems" | "off";

const SCRIPT_LIST_FILTERS: { value: ScriptListFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "problems", label: "Problems" },
  { value: "off", label: "Off" },
];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export function ScriptsPage() {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const scripts = useAppSelector(selectAllUserscripts);
  const selectedScript = useAppSelector(selectCurrentUserscript);
  const panelSizes = useAppSelector(selectPanelSizes);
  const sortBy = useAppSelector(selectScriptListSort);
  const sortedScripts = useMemo(
    () =>
      Object.values(scripts ?? {}).sort((a, b) =>
        sortBy === "created"
          ? a.createdAt - b.createdAt
          : a.name.localeCompare(b.name, undefined, {
              sensitivity: "base",
              numeric: true,
            })
      ),
    [scripts, sortBy]
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ScriptListFilter>("all");
  const scriptErrors = useAppSelector((state) => state.workspace.scriptErrors);
  const scriptsWithProblems = useMemo(
    () =>
      new Set(
        Object.entries(scriptErrors)
          .filter(([, byLanguage]) =>
            Object.values(byLanguage ?? {}).some(
              (errors) => (errors?.length ?? 0) > 0
            )
          )
          .map(([scriptId]) => scriptId)
      ),
    [scriptErrors]
  );
  const filterCounts: Record<ScriptListFilter, number> = {
    all: sortedScripts.length,
    problems: sortedScripts.filter((script) =>
      scriptsWithProblems.has(script.id)
    ).length,
    off: sortedScripts.filter((script) => !script.enabled).length,
  };
  const scriptGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const visible = sortedScripts.filter((script) => {
      if (filter === "problems" && !scriptsWithProblems.has(script.id)) {
        return false;
      }
      if (filter === "off" && script.enabled) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return (
        script.name.toLowerCase().includes(needle) ||
        (script.urlPatterns ?? []).some((pattern) =>
          pattern.toLowerCase().includes(needle)
        )
      );
    });
    return groupScriptsBySite(visible);
  }, [sortedScripts, query, filter, scriptsWithProblems]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const onCreateScript = async () => {
    try {
      await dispatch(createUserscript()).unwrap();
    } catch (error) {
      toast({
        variant: "error",
        message: `Failed to create script: ${getErrorMessage(error)}`,
      });
    }
  };

  const onExportScripts = useCallback(() => {
    try {
      const transferFile = buildUserscriptsTransferFile(scripts);
      const contents = stringifyUserscriptsTransferFile(transferFile);
      const blob = new Blob([contents], { type: "application/json" });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = `invert-userscripts-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);

      toast({
        variant: "info",
        message: `Exported ${transferFile.userscripts.length} userscript${transferFile.userscripts.length === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      toast({
        variant: "error",
        message: `Failed to export userscripts: ${getErrorMessage(error)}`,
      });
    }
  }, [scripts, toast]);

  const onImportScripts = useCallback(
    async (file: UserscriptsTransferFile) => {
      setIsImporting(true);

      try {
        const importedScripts = await dispatch(
          importUserscripts(file)
        ).unwrap();

        toast({
          variant: "info",
          message:
            importedScripts.length === 0
              ? "The selected file did not contain any userscripts to import."
              : `Imported ${importedScripts.length} userscript${importedScripts.length === 1 ? "" : "s"}.`,
        });
      } catch (error) {
        const message = `Failed to import userscripts: ${getErrorMessage(error)}`;

        toast({
          variant: "error",
          message,
        });

        throw error;
      } finally {
        setIsImporting(false);
      }
    },
    [dispatch, toast]
  );

  const onScriptSelected = (scriptId: string) => {
    dispatch(selectUserscript(scriptId));
  };

  return (
    <>
      <Group
        orientation="horizontal"
        id="scripts-page-panels"
        className="h-full min-w-0 flex-1 overflow-hidden"
        defaultLayout={{
          "scripts-sidebar": panelSizes.scriptListSidebarWidth,
          "scripts-editor": 100 - panelSizes.scriptListSidebarWidth,
        }}
        onLayoutChanged={(layout) => {
          const sidebarWidth = layout["scripts-sidebar"];
          if (sidebarWidth != null) {
            dispatch(
              updatePanelSizesIfChanged({
                scriptListSidebarWidth: sidebarWidth,
              })
            );
          }
        }}
      >
        <Panel
          id="scripts-sidebar"
          minSize="15%"
          maxSize="30%"
          className="min-h-0"
        >
          <div className="flex h-full min-h-0 flex-col bg-surface-raised">
            <div className="flex flex-col gap-sm border-b border-border p-md">
              <div className="flex items-center justify-between gap-2xs">
                <Typography variant="subtitle" className="min-w-0 truncate">
                  Scripts
                </Typography>
                <div className="flex shrink-0 items-center gap-2xs">
                  <ScriptsActionsMenu
                    sortBy={sortBy}
                    onSortChange={(value) => dispatch(setScriptListSort(value))}
                    onImportClick={() => setImportDialogOpen(true)}
                    onExportClick={onExportScripts}
                  />
                  <IconButton
                    icon={PlusIcon}
                    variant="ghost"
                    size="sm"
                    onClick={onCreateScript}
                    title="Create new script"
                  />
                </div>
              </div>
              <label className="flex h-(--input-height) items-center gap-2 rounded-default border border-border bg-surface-input px-2.5 text-text-muted-faint focus-within:border-accent-border focus-within:shadow-[0_0_0_3px_var(--accent-subtle)]">
                <SearchIcon size={14} aria-hidden className="shrink-0" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter by name or URL"
                  aria-label="Filter scripts"
                  className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-text-muted-faint"
                />
              </label>
              <div
                role="group"
                aria-label="Show scripts"
                className="flex flex-wrap gap-1"
              >
                {SCRIPT_LIST_FILTERS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                    className={clsx(
                      "h-6 rounded-default border px-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent",
                      filter === value
                        ? "border-selected bg-selected text-foreground"
                        : "border-border text-text-muted hover:text-foreground"
                    )}
                  >
                    {label} {filterCounts[value]}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative min-h-0 flex-1">
              <div className="flex h-full flex-col">
                <ScriptList
                  groups={scriptGroups}
                  onScriptSelected={onScriptSelected}
                  emptyMessage={
                    sortedScripts.length === 0
                      ? "No scripts yet. Create one with the + button."
                      : "No scripts match this filter."
                  }
                />
              </div>
              {isImporting && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-sm bg-scrim">
                  <LoaderCircleIcon
                    size={20}
                    className="animate-spin text-accent"
                  />
                  <span className="text-base text-text-muted">
                    Importing scripts…
                  </span>
                </div>
              )}
            </div>
          </div>
        </Panel>
        <ResizeHandle direction="horizontal" />
        <Panel
          id="scripts-editor"
          minSize="70%"
          maxSize="85%"
          className="flex min-h-0 flex-col"
        >
          {selectedScript ? (
            <ScriptEditor />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Typography variant="body">
                Select a script to edit it, or create a new one.
              </Typography>
            </div>
          )}
        </Panel>
      </Group>
      <ImportUserscriptsDialog
        open={importDialogOpen}
        importing={isImporting}
        onClose={() => setImportDialogOpen(false)}
        onImport={onImportScripts}
      />
    </>
  );
}
