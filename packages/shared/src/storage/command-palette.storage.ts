import { CommandPaletteState } from "../command-palette";

const DEFAULT_STATE: CommandPaletteState = {
  recentActions: [],
  actionUsageCount: {},
};

/**
 * Manages Command Palette state in chrome.storage.sync
 */
export class CommandPaletteStorage {
  private static readonly KEY = "commandPaletteState";

  /**
   * Get current Command Palette state
   */
  static async getState(): Promise<CommandPaletteState> {
    const result = await chrome.storage.sync.get(this.KEY);
    return { ...DEFAULT_STATE, ...(result[this.KEY] as CommandPaletteState) };
  }

  /**
   * Save Command Palette state
   */
  static async saveState(state: CommandPaletteState): Promise<void> {
    await chrome.storage.sync.set({ [this.KEY]: state });
  }

  /**
   * Record command usage (for ranking and recent history)
   */
  static async recordCommandUsage(commandId: string): Promise<void> {
    const state = await this.getState();

    // Update usage count
    state.actionUsageCount[commandId] =
      (state.actionUsageCount[commandId] || 0) + 1;

    // Add to recent actions (max 10, most recent first)
    state.recentActions = [
      commandId,
      ...state.recentActions.filter((id) => id !== commandId),
    ].slice(0, 10);

    await this.saveState(state);
  }

  /**
   * Get recent command IDs
   */
  static async getRecentActions(): Promise<string[]> {
    const state = await this.getState();
    return state.recentActions;
  }

  /**
   * Get usage count for a command
   */
  static async getUsageCount(commandId: string): Promise<number> {
    const state = await this.getState();
    return state.actionUsageCount[commandId] || 0;
  }

  /**
   * Save last test URL for URL Pattern Tester
   */
  static async saveLastTestUrl(url: string): Promise<void> {
    const state = await this.getState();
    state.lastTestUrl = url;
    await this.saveState(state);
  }

  /**
   * Get last test URL for URL Pattern Tester
   */
  static async getLastTestUrl(): Promise<string | undefined> {
    const state = await this.getState();
    return state.lastTestUrl;
  }
}
