import { IconButton } from '@/shared/components/icon-button/IconButton';
import { Typography } from '@/shared/components/typography/Typography';
import { SettingsIcon } from 'lucide-react';
import './InvertIdePopup.scss';

export function InvertIdePopup() {
  return (
    <div className="popup--container">
      <div className="popup--header">
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
