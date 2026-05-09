import { LucideIcon } from "lucide-react";

export type CommandCategory =
  | "navigation"
  | "script"
  | "editor"
  | "settings"
  | "search";

export interface Command {
  id: string;
  label: string;
  category: CommandCategory;
  icon?: LucideIcon;
  keywords?: string[];
  shortcut?: string;
  action: () => void | Promise<void>;
  when?: () => boolean;
  subActions?: Command[];
  description?: string;
}
