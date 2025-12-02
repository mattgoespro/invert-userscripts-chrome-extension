import { createRoot } from 'react-dom/client';
import { VertexIde } from './vertex-ide/VertexIde';
import { ThemeContext } from '@emotion/react';
import { theme } from '../shared/theme';

createRoot(document.getElementById('root')).render(
  <ThemeContext.Provider value={theme}>
    <VertexIde />
  </ThemeContext.Provider>
);
