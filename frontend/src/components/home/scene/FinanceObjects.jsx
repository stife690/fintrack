import { useMemo } from 'react';
import * as THREE from 'three';
import { roundedBox } from './shapes';

/*
 * Figuras de finanzas para flotar alrededor del logo. Todas comparten la plata mate
 * y llevan un detalle violeta de la marca. Se construyen con geometrías simples,
 * sin modelos externos. Cada una mide ~1 unidad para poder escalarlas igual.
 */

/** Materiales compartidos (se crean una vez por escena). */
export function useFinanceMaterials() {
  return useMemo(
    () => ({
      // MeshStandard (no Physical): compila un shader más liviano; en piezas pequeñas no se nota.
      silver: new THREE.MeshStandardMaterial({ color: '#e9e9ef', metalness: 0.85, roughness: 0.3 }),
      dark: new THREE.MeshStandardMaterial({ color: '#b8b8c4', metalness: 0.9, roughness: 0.4 }),
      violet: new THREE.MeshStandardMaterial({
        color: '#6142ff',
        metalness: 0.3,
        roughness: 0.25,
        emissive: '#2a1a99',
        emissiveIntensity: 0.25,
      }),
    }),
    [],
  );
}

/** Alcancía: cuerpo ovalado, hocico, orejas, patas y la ranura violeta. */
export function PiggyBank({ m }) {
  return (
    <group>
      <mesh material={m.silver} scale={[1.25, 1, 1]}>
        <sphereGeometry args={[0.5, 28, 18]} />
      </mesh>
      <mesh material={m.dark} position={[0.66, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.17, 0.19, 0.16, 28]} />
      </mesh>
      {[-0.12, 0.12].map((z) => (
        <mesh key={z} material={m.silver} position={[0.36, 0.42, z]} rotation={[0, 0, -0.4]}>
          <coneGeometry args={[0.1, 0.2, 20]} />
        </mesh>
      ))}
      {[
        [0.35, 0.22],
        [0.35, -0.22],
        [-0.35, 0.22],
        [-0.35, -0.22],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} material={m.dark} position={[x, -0.48, z]}>
          <cylinderGeometry args={[0.09, 0.09, 0.22, 16]} />
        </mesh>
      ))}
      <mesh material={m.violet} position={[-0.02, 0.5, 0]} geometry={roundedBox(0.34, 0.06, 0.1, 0.03)} />
    </group>
  );
}

/** Pila de monedas, con la de arriba en violeta. */
export function CoinStack({ m }) {
  const coins = [0, 1, 2, 3];
  return (
    <group>
      {coins.map((i) => (
        <mesh
          key={i}
          material={i === coins.length - 1 ? m.violet : m.silver}
          position={[Math.sin(i * 1.7) * 0.05, -0.33 + i * 0.2, Math.cos(i * 1.3) * 0.05]}
        >
          <cylinderGeometry args={[0.45, 0.45, 0.16, 32]} />
        </mesh>
      ))}
    </group>
  );
}

/** Calculadora: cuerpo, pantalla violeta y teclado de 3×4. */
export function Calculator({ m }) {
  const keys = useMemo(() => {
    const list = [];
    for (let r = 0; r < 4; r += 1) for (let c = 0; c < 3; c += 1) list.push([c, r]);
    return list;
  }, []);
  const key = useMemo(() => roundedBox(0.2, 0.15, 0.08, 0.04), []);
  return (
    <group>
      <mesh material={m.silver} geometry={roundedBox(0.8, 1.1, 0.16, 0.1)} />
      <mesh material={m.violet} position={[0, 0.33, 0.08]} geometry={roundedBox(0.62, 0.22, 0.05, 0.04)} />
      {keys.map(([c, r]) => (
        <mesh key={`${c}${r}`} material={m.dark} geometry={key} position={[-0.22 + c * 0.22, 0.08 - r * 0.17, 0.09]} />
      ))}
    </group>
  );
}

/** Candado: cuerpo, arco y cerradura violeta. */
export function Padlock({ m }) {
  return (
    <group>
      <mesh material={m.silver} geometry={roundedBox(0.8, 0.62, 0.3, 0.1)} position={[0, -0.18, 0]} />
      <mesh material={m.dark} position={[0, 0.13, 0]}>
        <torusGeometry args={[0.25, 0.065, 16, 40, Math.PI]} />
      </mesh>
      <mesh material={m.violet} position={[0, -0.14, 0.16]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.04, 24]} />
      </mesh>
      <mesh material={m.violet} position={[0, -0.27, 0.16]} geometry={roundedBox(0.06, 0.16, 0.04, 0.02)} />
    </group>
  );
}

/** Flecha de tendencia que sube (zigzag) con la punta violeta. */
export function TrendArrow({ m }) {
  const geos = useMemo(() => {
    const pts = [
      [-0.55, -0.4],
      [-0.15, 0.0],
      [0.08, -0.2],
      [0.45, 0.2],
    ];
    const shape = new THREE.Shape();
    const t = 0.07;
    const segs = [];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      segs.push({ x: (x1 + x2) / 2, y: (y1 + y2) / 2, len: Math.hypot(x2 - x1, y2 - y1) + t, ang: Math.atan2(y2 - y1, x2 - x1) });
    }
    shape.moveTo(-0.13, -0.13);
    shape.lineTo(0.17, 0);
    shape.lineTo(-0.13, 0.13);
    shape.lineTo(-0.13, -0.13);
    const head = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 });
    head.translate(0, 0, -0.07);
    return { segs, head, rod: roundedBox(1, t * 2, 0.14, 0.05) };
  }, []);
  const tipAngle = Math.atan2(0.4, 0.37);
  return (
    <group>
      {geos.segs.map((s, i) => (
        <mesh key={i} material={m.silver} geometry={geos.rod} position={[s.x, s.y, 0]} rotation={[0, 0, s.ang]} scale={[s.len, 1, 1]} />
      ))}
      <mesh material={m.violet} geometry={geos.head} position={[0.5, 0.25, 0]} rotation={[0, 0, tipAngle]} />
    </group>
  );
}

/** Calendario: hoja, franja violeta arriba, argollas y días. */
export function CalendarBlock({ m }) {
  const days = useMemo(() => {
    const list = [];
    for (let r = 0; r < 3; r += 1) for (let c = 0; c < 4; c += 1) list.push([c, r]);
    return list;
  }, []);
  const day = useMemo(() => roundedBox(0.13, 0.11, 0.04, 0.03), []);
  return (
    <group>
      <mesh material={m.silver} geometry={roundedBox(0.9, 0.9, 0.14, 0.1)} />
      <mesh material={m.violet} position={[0, 0.33, 0.04]} geometry={roundedBox(0.9, 0.24, 0.1, 0.08)} />
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} material={m.dark} position={[x, 0.47, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.2, 16]} />
        </mesh>
      ))}
      {days.map(([c, r]) => (
        <mesh
          key={`${c}${r}`}
          material={c === 2 && r === 1 ? m.violet : m.dark}
          geometry={day}
          position={[-0.27 + c * 0.18, 0.06 - r * 0.16, 0.08]}
        />
      ))}
    </group>
  );
}
