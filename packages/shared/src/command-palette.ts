/**
 * Command Palette state persisted in chrome.storage.sync
 */
export interface CommandPaletteState {
  /**
   * Recent command IDs (last 10)
   */
  recentActions: string[];

  /**
   * Usage count per command for ranking
   */
  actionUsageCount: Record<string, number>;

  /**
   * Last test URL used in URL Pattern Tester
   */
  lastTestUrl?: string;
}
