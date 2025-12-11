import './Sidebar.scss';
import { IconButton } from '../../../shared/components/icon-button/IconButton';
import { SettingsIcon, PackageIcon, ClipboardPenIcon } from 'lucide-react';

export type SidebarButton = 'scripts' | 'modules' | 'settings';

interface SidebarProps {
  active: SidebarButton;
  onNavigate: (tab: SidebarButton) => void;
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <div className="sidebar">
      <IconButton
        className={active === 'scripts' ? 'active' : ''}
        onClick={() => onNavigate('scripts')}
      >
        <ClipboardPenIcon color="#d3cbc5ff" size={16} />
      </IconButton>
      <IconButton
        className={active === 'modules' ? 'active' : ''}
        onClick={() => onNavigate('modules')}
      >
        <PackageIcon color="#d3cbc5ff" size={16} />
      </IconButton>
      <IconButton
        className={active === 'settings' ? 'active' : ''}
        onClick={() => onNavigate('settings')}
      >
        <SettingsIcon color="#d3cbc5ff" size={16} />
      </IconButton>
    </div>
  );
}
