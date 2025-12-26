import { IconButton } from '@/shared/components/icon-button/IconButton';
import { Typography } from '@/shared/components/typography/Typography';
import { SettingsIcon } from 'lucide-react';
import './VertexIdePopup.scss';

export function VertexIdePopup() {
  return (
    <div className="popup--container">
      <div className="popup--header">
        <Typography variant="title">Vertex IDE</Typography>
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
