import LegalPage from './LegalPage';
import { TERMS } from './legalContent';

/** Página pública `/terminos`: términos de uso de FinTrack (FT-0017). */
export default function Terms() {
  return (
    <LegalPage
      title="Términos de uso"
      sections={TERMS}
      other={{ to: '/privacidad', label: 'Leer la política de privacidad' }}
    />
  );
}
