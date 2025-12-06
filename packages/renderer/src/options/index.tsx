import { createRoot } from 'react-dom/client';
import '../styles/globals.scss';
import { VertexIde } from './vertex-ide/VertexIde';

createRoot(document.getElementById('root')).render(<VertexIde />);
