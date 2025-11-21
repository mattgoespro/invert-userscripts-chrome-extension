import { createRoot } from 'react-dom/client';
import OptionsApp from './vertex-ide/VertexIde';

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<OptionsApp />);
