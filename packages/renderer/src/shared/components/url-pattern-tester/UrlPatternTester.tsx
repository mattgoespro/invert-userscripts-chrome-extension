import { Button } from "@/shared/components/button/Button";
import { Input } from "@/shared/components/input/Input";
import { Typography } from "@/shared/components/typography/Typography";
import { matchesUrlPattern } from "@shared/url-matching";
import {
  AlertCircle,
  CheckCircle2,
  CrossIcon,
  Globe,
  History,
} from "lucide-react";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { IconButton } from "../icon-button/IconButton";

type UrlPatternTesterProps = {
  patterns: string[];
  onClose: () => void;
  onPatternsChange: (patterns: string[]) => void;
};

type TestResult = {
  url: string;
  matches: boolean;
  matchedPattern?: string;
};

export function UrlPatternTester({ patterns, onClose }: UrlPatternTesterProps) {
  const [testUrl, setTestUrl] = useState("");
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [openTabUrls, setOpenTabUrls] = useState<string[]>([]);
  const [recentHistoryUrls, setRecentHistoryUrls] = useState<string[]>([]);

  // Test the current URL against all patterns
  useEffect(() => {
    if (!testUrl) {
      setTestResults([]);
      return;
    }

    const matches = matchesUrlPattern(testUrl, patterns);
    const matchedPattern = patterns.find((pattern) =>
      matchesUrlPattern(testUrl, [pattern])
    );

    setTestResults([
      {
        url: testUrl,
        matches,
        matchedPattern,
      },
    ]);
  }, [testUrl, patterns]);

  const handleTestOpenTabs = async () => {
    try {
      const tabs = await chrome.tabs.query({});
      const urls = tabs.map((tab) => tab.url).filter(Boolean) as string[];
      setOpenTabUrls(urls);

      const results: TestResult[] = urls.map((url) => {
        const matches = matchesUrlPattern(url, patterns);
        const matchedPattern = patterns.find((pattern) =>
          matchesUrlPattern(url, [pattern])
        );
        return { url, matches, matchedPattern };
      });

      setTestResults(results);
    } catch (error) {
      console.error("Failed to query tabs:", error);
    }
  };

  const handleTestHistory = async () => {
    try {
      const historyItems = await chrome.history.search({
        text: "",
        maxResults: 50,
        startTime: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
      });
      const urls = historyItems
        .map((item) => item.url)
        .filter(Boolean) as string[];
      setRecentHistoryUrls(urls);

      const results: TestResult[] = urls.map((url) => {
        const matches = matchesUrlPattern(url, patterns);
        const matchedPattern = patterns.find((pattern) =>
          matchesUrlPattern(url, [pattern])
        );
        return { url, matches, matchedPattern };
      });

      setTestResults(results);
    } catch (error) {
      console.error("Failed to query history:", error);
    }
  };

  return (
    <div className="backdrop-blur-sm fixed inset-0 z-1000 flex animate-fade-in items-center justify-center bg-[rgba(0,0,0,0.6)]">
      <div className="max-w-3xl shadow-2xl flex max-h-[90vh] w-full flex-col gap-md overflow-hidden rounded-default border border-border bg-surface-raised p-lg">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-sm">
            <Globe className="h-5 w-5 text-accent" />
            <Typography variant="title">URL Pattern Tester</Typography>
          </div>
          <IconButton icon={CrossIcon} onClick={onClose}>
            Close
          </IconButton>
        </div>

        {/* Test URL Input */}
        <div className="flex flex-col gap-xs">
          <Typography
            variant="caption"
            className="font-mono text-text-muted uppercase"
          >
            Test URL
          </Typography>
          <Input
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            placeholder="https://example.com/page"
            autoFocus
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-sm">
          <Button variant="secondary" onClick={handleTestOpenTabs}>
            <Globe className="h-4 w-4" />
            Test Open Tabs ({openTabUrls.length})
          </Button>
          <Button variant="secondary" onClick={handleTestHistory}>
            <History className="h-4 w-4" />
            Test Recent History ({recentHistoryUrls.length})
          </Button>
        </div>

        {/* Current Patterns */}
        <div className="flex flex-col gap-xs">
          <Typography
            variant="caption"
            className="font-mono text-text-muted uppercase"
          >
            Current Patterns ({patterns.length})
          </Typography>
          <div className="flex flex-col gap-2xs rounded-default border border-border bg-surface-base p-sm">
            {patterns.length === 0 ? (
              <Typography variant="body" className="text-text-muted">
                No patterns defined
              </Typography>
            ) : (
              patterns.map((pattern, index) => (
                <div
                  key={index}
                  className="rounded-[3px] bg-surface-raised px-sm py-xs font-mono text-sm text-text-muted-strong"
                >
                  {pattern}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="flex min-h-0 flex-1 flex-col gap-xs overflow-hidden">
            <Typography
              variant="caption"
              className="font-mono text-text-muted uppercase"
            >
              Test Results ({testResults.filter((r) => r.matches).length}{" "}
              matches)
            </Typography>
            <div className="scrollbar-thin-6 min-h-0 flex-1 overflow-y-auto rounded-default border border-border bg-surface-base">
              <div className="flex flex-col gap-2xs p-sm">
                {testResults.map((result, index) => (
                  <TestResultItem key={index} result={result} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TestResultItem({ result }: { result: TestResult }) {
  return (
    <div
      className={clsx(
        "flex items-start gap-sm rounded-default border p-sm transition-colors",
        result.matches
          ? "border-accent-border bg-accent-subtle"
          : "border-border bg-surface-raised"
      )}
    >
      <div className="shrink-0 pt-[2px]">
        {result.matches ? (
          <CheckCircle2 className="h-4 w-4 text-accent" />
        ) : (
          <AlertCircle className="h-4 w-4 text-text-muted" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2xs">
        <Typography
          variant="body"
          className={clsx(
            "font-mono text-xs wrap-break-word",
            result.matches ? "text-text-muted-strong" : "text-text-muted"
          )}
        >
          {result.url}
        </Typography>
        {result.matchedPattern && (
          <Typography variant="caption" className="font-mono text-accent">
            Matched: {result.matchedPattern}
          </Typography>
        )}
      </div>
    </div>
  );
}
