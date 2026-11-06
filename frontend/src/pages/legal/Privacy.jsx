import LegalPage from './LegalPage';
import { PRIVACY } from './legalContent';

/** Página pública `/privacidad`: política de privacidad y tratamiento de datos (FT-0017). */
export default function Privacy() {
  return (
    <LegalPage
      title="Política de privacidad"
      sections={PRIVACY}
      other={{ to: '/terminos', label: 'Leer los términos de uso' }}
    />
  );
}
