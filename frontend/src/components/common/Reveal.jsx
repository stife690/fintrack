import { motion } from 'framer-motion';

/**
 * Aparición con fade + desplazamiento al entrar en pantalla (una sola vez),
 * como las secciones de la plantilla. `MotionConfig reducedMotion="user"` en
 * `main.jsx` la desactiva si el usuario prefiere menos movimiento.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {number} [props.delay=0] Retraso en segundos, para escalonar elementos.
 * @param {number} [props.y=24] Desplazamiento vertical inicial en px.
 * @param {string} [props.className]
 * @param {keyof typeof motion} [props.as='div'] Elemento HTML a renderizar.
 */
export default function Reveal({ children, delay = 0, y = 24, className, as = 'div' }) {
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Comp>
  );
}
