import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

/** Punto de entrada del frontend: monta `<App />` en el elemento `#root`. */
createRoot(document.getElementById('root')).render(<App />);
