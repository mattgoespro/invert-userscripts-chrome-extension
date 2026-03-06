import { InfoIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Userscript } from "@shared/model";
import { SassCompiler, TypeScriptCompiler } from "@/sandbox/compiler";
import { Panel, PanelHeader, PanelSection, PanelDivider } from "@/shared/components/panel/Panel";
import "./FileSizeIndicator.scss";

type FileSizeIndicatorProps = {
  script: Userscript;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function getByteSize(text: string): number {
  return new Blob([text]).size;
}

export function FileSizeIndicator({ script }: FileSizeIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [compiledJs, setCompiledJs] = useState("");
  const [compiledCss, setCompiledCss] = useState("");

  // Compile source code to get accurate compiled sizes
  useEffect(() => {
    const tsResult = TypeScriptCompiler.compile(script.code.source.typescript);
    setCompiledJs(tsResult.success && tsResult.code ? tsResult.code : "");

    SassCompiler.compile(script.code.source.scss).then((scssResult) => {
      setCompiledCss(scssResult.success && scssResult.code ? scssResult.code : "");
    });
  }, [script.code.source.typescript, script.code.source.scss]);

  const tsSize = getByteSize(script.code.source.typescript);
  const scssSize = getByteSize(script.code.source.scss);
  const jsSize = getByteSize(compiledJs);
  const cssSize = getByteSize(compiledCss);

  const totalSourceSize = tsSize + scssSize;
  const totalCompiledSize = jsSize + cssSize;
  const totalSize = totalSourceSize + totalCompiledSize;

  // Storage quota limits
  const syncQuotaPerItem = 8 * 1024; // 8 KB
  const syncQuotaTotal = 100 * 1024; // 100 KB
  const localQuotaTotal = 5 * 1024 * 1024; // 5 MB

  const percentageOfSyncQuota = (totalSize / syncQuotaPerItem) * 100;
  const exceedsSyncQuota = totalSize > syncQuotaPerItem;

  return (
    <div className="file-size-indicator--wrapper">
      <div
        className={`file-size-indicator--icon ${exceedsSyncQuota ? "file-size-indicator--icon-warning" : ""}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <InfoIcon size={16} />
        {exceedsSyncQuota && <div className="file-size-indicator--badge">!</div>}
      </div>
      {showTooltip && (
        <Panel className="file-size-indicator--tooltip" minWidth="22rem">
          <PanelHeader>source code</PanelHeader>
          <PanelSection>
            <div className="file-size-indicator--item">
              <span className="file-size-indicator--file">typescript:</span>
              <span className="file-size-indicator--value">{formatBytes(tsSize)}</span>
            </div>
            <div className="file-size-indicator--item">
              <span className="file-size-indicator--file">scss:</span>
              <span className="file-size-indicator--value">{formatBytes(scssSize)}</span>
            </div>
            <div className="file-size-indicator--total">
              <span>Total Source:</span>
              <span>{formatBytes(totalSourceSize)}</span>
            </div>
          </PanelSection>

          <PanelDivider />

          <PanelHeader>compiled code</PanelHeader>
          <PanelSection>
            <div className="file-size-indicator--item">
              <span className="file-size-indicator--file">javascript:</span>
              <span className="file-size-indicator--value">{formatBytes(jsSize)}</span>
            </div>
            <div className="file-size-indicator--item">
              <span className="file-size-indicator--file">css:</span>
              <span className="file-size-indicator--value">{formatBytes(cssSize)}</span>
            </div>
            <div className="file-size-indicator--total">
              <span>Total Compiled:</span>
              <span>{formatBytes(totalCompiledSize)}</span>
            </div>
          </PanelSection>

          <PanelDivider />

          <PanelSection className="file-size-indicator--totals">
            <div className="file-size-indicator--grand-total">
              <span className="file-size-indicator--label">Total Size:</span>
              <span className="file-size-indicator--value">{formatBytes(totalSize)}</span>
            </div>
            <div
              className={`file-size-indicator--quota ${exceedsSyncQuota ? "file-size-indicator--quota-exceeded" : ""}`}
            >
              <span className="file-size-indicator--label">
                chrome.storage.sync quota (per-item):
              </span>
              <span className="file-size-indicator--value">
                {percentageOfSyncQuota.toFixed(1)}% of {formatBytes(syncQuotaPerItem)}
              </span>
              {exceedsSyncQuota && (
                <div className="file-size-indicator--warning">⚠️ Exceeds sync quota limit!</div>
              )}
            </div>
          </PanelSection>

          <PanelDivider />

          <PanelSection className="file-size-indicator--note-section">
            <div className="file-size-indicator--note">
              <strong>Note:</strong> Chrome storage limits: sync = {formatBytes(syncQuotaPerItem)}{" "}
              per-item / {formatBytes(syncQuotaTotal)} total, local = {formatBytes(localQuotaTotal)}{" "}
              total
            </div>
          </PanelSection>
        </Panel>
      )}
    </div>
  );
}
