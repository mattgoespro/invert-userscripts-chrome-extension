import { createRoot } from 'react-dom/client';
import { OptionsApp } from './vertex-ide/VertexIde';

const container = document.getElementById('root')!;
const root = createRoot(container);
console.log();
root.render(<OptionsApp />);
