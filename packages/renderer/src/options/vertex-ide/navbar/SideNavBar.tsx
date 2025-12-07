import ScriptsIcon from '@mui/icons-material/Code';
import ModulesIcon from '@mui/icons-material/Extension';
import SettingsIcon from '@mui/icons-material/Settings';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';

export enum IdeTab {
  Scripts = 'scripts',
  Modules = 'modules',
  Settings = 'settings',
}

interface SideNavBarProps {
  activeTab: IdeTab;
  onTabChange: (tab: IdeTab) => void;
}

export function SideNavBar({ activeTab, onTabChange }: SideNavBarProps) {
  return (
    <Drawer
      variant="permanent"
      open={true}
      sx={{
        width: 60,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 60,
          boxSizing: 'border-box',
          position: 'relative',
          height: '100%',
        },
      }}
    >
      <List>
        <ListItem key="Scripts" disablePadding sx={{ display: 'block' }}>
          <ListItemButton
            selected={activeTab === IdeTab.Scripts}
            onClick={() => onTabChange(IdeTab.Scripts)}
            sx={{
              minHeight: 48,
              justifyContent: 'center',
              px: 2.5,
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: 'auto',
                justifyContent: 'center',
              }}
            >
              <ScriptsIcon />
            </ListItemIcon>
          </ListItemButton>
        </ListItem>

        <ListItem key="Modules" disablePadding sx={{ display: 'block' }}>
          <ListItemButton
            selected={activeTab === IdeTab.Modules}
            onClick={() => onTabChange(IdeTab.Modules)}
            sx={{
              minHeight: 48,
              justifyContent: 'center',
              px: 2.5,
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: 'auto',
                justifyContent: 'center',
              }}
            >
              <ModulesIcon />
            </ListItemIcon>
          </ListItemButton>
        </ListItem>
        <Divider />
        <ListItem key="Settings" disablePadding sx={{ display: 'block' }}>
          <ListItemButton
            selected={activeTab === IdeTab.Settings}
            onClick={() => onTabChange(IdeTab.Settings)}
            sx={{
              minHeight: 48,
              justifyContent: 'center',
              px: 2.5,
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: 'auto',
                justifyContent: 'center',
              }}
            >
              <SettingsIcon />
            </ListItemIcon>
          </ListItemButton>
        </ListItem>
      </List>
    </Drawer>
  );
}
