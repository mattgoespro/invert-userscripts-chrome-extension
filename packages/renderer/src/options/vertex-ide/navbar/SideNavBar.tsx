import ScriptsIcon from '@mui/icons-material/Code';
import ModulesIcon from '@mui/icons-material/Extension';
import SettingsIcon from '@mui/icons-material/Settings';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';

export function SideNavBar() {
  return (
    <Drawer variant="permanent" open={true}>
      <List>
        <ListItem key="Scripts" disablePadding sx={{ display: 'block' }}>
          <ListItemButton>
            <ListItemIcon>
              <ScriptsIcon />
            </ListItemIcon>
          </ListItemButton>
        </ListItem>

        <ListItem key="Modules" disablePadding sx={{ display: 'block' }}>
          <ListItemButton>
            <ListItemIcon>
              <ModulesIcon />
            </ListItemIcon>
          </ListItemButton>
        </ListItem>
        <Divider />
        <ListItem key="Settings" disablePadding sx={{ display: 'block' }}>
          <ListItemButton>
            <ListItemIcon>
              <SettingsIcon />
            </ListItemIcon>
          </ListItemButton>
        </ListItem>
      </List>
    </Drawer>
  );
}
