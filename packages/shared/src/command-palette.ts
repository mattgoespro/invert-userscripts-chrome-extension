import { LucideIcon } from "lucide-react";

/**
 * Command categories for grouping related actions
 */
export type CommandCategory =
  | "navigation"
  | "script"
  | "editor"
  | "settings"
  | "search";

/**
 * Represents a command action in the Command Palette
 */
export interface Command {
  /**
   * Unique identifier for the command
   */
  id: string;

  /**
   * Display label shown in palette
   */
  label: string;

  /**
   * Category for grouping and filtering
   */
  category: CommandCategory;

  /**
   * Optional icon to display
   */
  icon?: LucideIcon;

  /**
   * Keywords for fuzzy search matching
   */
  keywords?: string[];

  /**
   * Keyboard shortcut display (e.g., "Cmd+N")
   */
  shortcut?: string;

  /**
   * Action to execute when command is selected
   */
  action: () => void | Promise<void>;

  /**
   * Optional condition for command visibility
   */
  when?: () => boolean;

  /**
   * Optional sub-actions for nested commands
   */
  subActions?: Command[];

  /**
   * Optional description for tooltip/help
   */
  description?: string;
}

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
