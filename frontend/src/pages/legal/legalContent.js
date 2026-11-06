/**
 * Términos de uso y política de privacidad de FinTrack (FT-0017). Un solo lugar para el texto y su
 * versión: las páginas `/terminos` y `/privacidad` lo pintan y el registro guarda `LEGAL_VERSION`
 * con la fecha en que la persona acepta. Al cambiar el texto de fondo hay que subir la versión,
 * y quienes aceptaron la anterior la vuelven a aceptar al entrar.
 */

/** Versión vigente (fecha de publicación, AAAA-MM-DD). La misma que valida el backend. */
export const LEGAL_VERSION = '2026-11-05';

/** Canal para consultas, reclamos y el ejercicio de los derechos sobre los datos. */
export const CONTACT_EMAIL = 'fintrackcolombia@gmail.com';

/** Responsables del tratamiento de los datos. */
export const RESPONSIBLES = [
  'Andrés Felipe González Quiñones',
  'David Felipe Roa Rocha',
  'Nicolás Mosquera Perdomo',
];

/**
 * @typedef {object} LegalSection
 * @property {string} title
 * @property {string[]} [paragraphs]
 * @property {string[]} [items] Lista de viñetas, después de los párrafos.
 */

/** @type {LegalSection[]} */
export const TERMS = [
  {
    title: '1. Qué es FinTrack',
    paragraphs: [
      'FinTrack es una aplicación web para llevar las finanzas personales: registrar ingresos y gastos, armar presupuestos, recibir consejos y recordatorios, juntar plata en grupo (vacas) y llevar las cuentas de un emprendimiento con sus socios. Es un proyecto de estudiantes y hoy es gratuito.',
      `La prestan ${RESPONSIBLES.join(', ')} (en adelante, "nosotros"). Puedes escribirnos a ${CONTACT_EMAIL}.`,
    ],
  },
  {
    title: '2. Aceptación',
    paragraphs: [
      'Al crear tu cuenta (con correo o con Google) aceptas estos términos y la política de privacidad. Si no estás de acuerdo, no uses la aplicación. Si los cambiamos de fondo te avisaremos dentro de la aplicación y te pediremos aceptarlos de nuevo.',
    ],
  },
  {
    title: '3. Tu cuenta',
    items: [
      'Debes ser mayor de edad (18 años) para crear una cuenta.',
      'Los datos que registres deben ser tuyos o de un grupo del que hagas parte.',
      'Cuida tu contraseña: eres responsable de lo que se haga con tu cuenta.',
      'Puedes eliminar tu cuenta cuando quieras desde Cuenta; se borran tus datos como explica la política de privacidad.',
    ],
  },
  {
    title: '4. Lo que FinTrack es y no es',
    items: [
      'FinTrack te ayuda a ordenar tu información. No es un banco, no recibe, guarda ni mueve tu dinero y no se conecta a tus cuentas bancarias.',
      'Los consejos, proyecciones y cálculos (incluidos los generados con inteligencia artificial) son orientativos, pueden tener errores y no son asesoría financiera, tributaria ni legal. Las decisiones sobre tu dinero son tuyas.',
      'En las vacas y los negocios, FinTrack solo registra lo que cada persona anota. Los acuerdos de plata entre los miembros o socios son entre ellos.',
    ],
  },
  {
    title: '5. Uso permitido',
    paragraphs: ['No puedes usar FinTrack para:'],
    items: [
      'actividades ilegales, fraude o lavado de activos;',
      'invitar a personas sin su consentimiento o publicar datos de terceros;',
      'intentar acceder a cuentas o datos de otros, o afectar el funcionamiento del servicio.',
    ],
  },
  {
    title: '6. Disponibilidad',
    paragraphs: [
      'Hacemos lo posible para que FinTrack funcione siempre, pero al ser un servicio gratuito en etapa de proyecto puede tener interrupciones, cambios o dejar de prestarse. Si eso pasa te avisaremos con anticipación para que puedas descargar tus movimientos.',
    ],
  },
  {
    title: '7. Responsabilidad',
    paragraphs: [
      'En la medida que lo permita la ley, no respondemos por pérdidas derivadas de decisiones tomadas con base en la información de la aplicación, de datos mal registrados o de fallas de servicios de terceros. Nada de esto limita los derechos que te da el Estatuto del Consumidor (Ley 1480 de 2011).',
    ],
  },
  {
    title: '8. Ley aplicable',
    paragraphs: [
      `Estos términos se rigen por las leyes de Colombia. Si tienes un problema, escríbenos primero a ${CONTACT_EMAIL} para buscar una solución.`,
    ],
  },
];

/** @type {LegalSection[]} */
export const PRIVACY = [
  {
    title: '1. Quién trata tus datos',
    paragraphs: [
      `Los responsables del tratamiento son ${RESPONSIBLES.join(', ')}. Contacto: ${CONTACT_EMAIL}. Esta política sigue la Ley 1581 de 2012 y el Decreto 1377 de 2013 de protección de datos personales.`,
    ],
  },
  {
    title: '2. Qué datos recogemos',
    items: [
      'Cuenta: correo, nombre (opcional), contraseña guardada de forma cifrada (nunca la vemos), zona horaria y preferencias.',
      'Finanzas: los movimientos, presupuestos, tarjetas, cuentas por cobrar o pagar y metas que registres, y los soportes (fotos o PDF) que adjuntes.',
      'Grupos: las vacas y los negocios de los que hagas parte, tus aportes y movimientos en ellos, y tu rol.',
      'Voz y WhatsApp (solo si los usas): el audio que dictas para anotar y los mensajes que envíes al bot.',
      'Notificaciones: los datos técnicos de tu navegador para enviarte avisos push, si los activas.',
    ],
    paragraphs: ['No recogemos datos de tus cuentas bancarias ni tus contraseñas bancarias.'],
  },
  {
    title: '3. Para qué los usamos',
    items: [
      'Prestarte el servicio: guardar tus registros, calcular tus totales, presupuestos y avances.',
      'Clasificar tus movimientos, darte consejos y responder tus preguntas al asistente, también con inteligencia artificial.',
      'Enviarte correos de verificación, recuperación de contraseña e invitaciones, y recordatorios que tú configures.',
      'Mostrar a los miembros de una vaca o socios de un negocio lo que corresponde a ese grupo.',
      'Mantener la seguridad del servicio y corregir errores.',
    ],
    paragraphs: ['No vendemos tus datos ni los usamos para publicidad.'],
  },
  {
    title: '4. Con quién se comparten',
    paragraphs: [
      'Usamos proveedores que procesan datos por nosotros, solo para lo necesario. Algunos están fuera de Colombia, así que al aceptar autorizas esa transferencia internacional:',
    ],
    items: [
      'Supabase: base de datos y almacenamiento de soportes.',
      'Render y Vercel: servidores donde corre la aplicación.',
      'Google Gemini (IA): recibe la descripción de un movimiento para sugerir su categoría; para los consejos, solo totales agregados (sin nombres ni descripciones); y lo que le escribas al asistente o al bot de WhatsApp, junto con los totales por categoría que el asistente consulte para responderte.',
      'Groq: transcribe el audio cuando dictas un movimiento; no guardamos el audio.',
      'Meta (WhatsApp), solo si vinculas tu número al bot.',
      'Brevo: envío de correos.',
      'Los servicios de notificaciones de tu navegador (Google, Apple o Mozilla), si activas los avisos.',
    ],
  },
  {
    title: '5. Tus derechos',
    paragraphs: ['Como titular de los datos puedes:'],
    items: [
      'conocer, actualizar y rectificar tus datos (muchos los cambias tú mismo en la aplicación);',
      'pedir prueba de la autorización que nos diste;',
      'saber cómo hemos usado tus datos;',
      'revocar la autorización y pedir que borremos tus datos: puedes eliminar tu cuenta desde Cuenta o escribirnos;',
      'presentar quejas ante la Superintendencia de Industria y Comercio después de consultarnos.',
    ],
  },
  {
    title: '6. Cómo ejercerlos',
    paragraphs: [
      `Escríbenos a ${CONTACT_EMAIL} desde el correo de tu cuenta. Respondemos consultas en máximo 10 días hábiles y reclamos en máximo 15 días hábiles, como indica la ley.`,
    ],
  },
  {
    title: '7. Cuánto tiempo los guardamos',
    paragraphs: [
      'Mientras tengas la cuenta. Al eliminarla borramos tus datos personales y tus registros; los aportes y movimientos que hiciste en vacas o negocios de otros quedan sin tu nombre para no alterar los totales del grupo. Las copias de seguridad de los proveedores se borran en sus ciclos normales.',
    ],
  },
  {
    title: '8. Seguridad',
    paragraphs: [
      'Las conexiones van cifradas (HTTPS), las contraseñas se guardan con un algoritmo de un solo sentido y cada consulta a la base solo devuelve los datos de quien la hace. Ningún sistema es infalible: si detectamos un incidente que afecte tus datos te avisaremos.',
    ],
  },
  {
    title: '9. Datos en tu dispositivo y cookies',
    paragraphs: [
      'Para funcionar sin conexión, FinTrack guarda en tu navegador una copia de tus datos y tu sesión. No usamos cookies de rastreo ni de publicidad. Al cerrar sesión se borra la copia del dispositivo.',
    ],
  },
  {
    title: '10. Menores de edad',
    paragraphs: ['FinTrack es para mayores de 18 años. No recogemos a sabiendas datos de menores.'],
  },
  {
    title: '11. Cambios',
    paragraphs: [
      'Si cambiamos esta política de fondo te avisaremos en la aplicación y te pediremos aceptarla de nuevo. Arriba aparece la fecha de la versión vigente.',
    ],
  },
];
