import { ClipboardPenIcon, PackageIcon, SettingsIcon } from 'lucide-react';
import { IconButton } from '../../../shared/components/icon-button/IconButton';
import './Sidebar.scss';

export type SidebarButton = 'scripts' | 'modules' | 'settings';

interface SidebarProps {
  active: SidebarButton;
  onNavigate: (tab: SidebarButton) => void;
}

const SidebarButtonIconSize = 24;

export function Sidebar({ active: active, onNavigate }: SidebarProps) {
  return (
    <div className="sidebar">
      <IconButton
        className={active === 'scripts' ? 'active' : ''}
        onClick={() => onNavigate('scripts')}
      >
        <ClipboardPenIcon
          color="#d3cbc5ff"
          size={SidebarButtonIconSize}
          absoluteStrokeWidth
          strokeWidth={1}
        />
      </IconButton>
      <IconButton
        className={active === 'modules' ? 'active' : ''}
        onClick={() => onNavigate('modules')}
      >
        <PackageIcon
          color="#d3cbc5ff"
          size={SidebarButtonIconSize}
          absoluteStrokeWidth
          strokeWidth={1}
        />
      </IconButton>
      <IconButton
        className={active === 'settings' ? 'active' : ''}
        onClick={() => onNavigate('settings')}
      >
        <SettingsIcon
          color="#d3cbc5ff"
          size={SidebarButtonIconSize}
          absoluteStrokeWidth
          strokeWidth={1}
        />
      </IconButton>
    </div>
  );
}
