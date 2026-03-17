import { IconButton } from "@/shared/components/icon-button/IconButton";
import { Typography } from "@/shared/components/typography/Typography";
import { SettingsIcon } from "lucide-react";

export function InvertIdePopup() {
  return (
    <div className="flex flex-col p-4 bg-background text-foreground">
      <div className="flex justify-between items-center mb-4 pb-3">
        <Typography variant="title">Invert IDE</Typography>
        <IconButton
          icon={SettingsIcon}
          size="sm"
          onClick={() => {
            chrome.runtime.openOptionsPage();
          }}
        />
      </div>
      <span>
        <i>TODO</i>
      </span>
    </div>
  );
}
