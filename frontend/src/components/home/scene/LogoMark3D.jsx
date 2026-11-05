import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { roundedBox } from './shapes';

/*
 * Isotipo de FinTrack en 3D, a partir del SVG del logo (viewBox 32×32):
 * cuadro violeta de 32 con radio 9 y tres barras de 4 de ancho con alturas 7, 12 y 17.
 * Escala: 1 unidad del SVG = 0.1 unidades de la escena.
 */
const U = 0.1;
const BARS = [
  { x: 10, height: 7, tone: '#d9d2ff' },
  { x: 16, height: 12, tone: '#efeaff' },
  { x: 22, height: 17, tone: '#ffffff' },
];
const BASE_Y = 24; // las barras arrancan en y = 24 del SVG (borde inferior)
const easeOutBack = (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;

/**
 * Logo 3D: el cuadro violeta lacado y las barras plateadas que crecen al cargar.
 * La posición, escala y giro por scroll los aplica el padre; aquí solo vive el objeto.
 * @param {{ reducedMotion?: boolean }} props
 */
export default function LogoMark3D({ reducedMotion = false, mixRef }) {
  const bars = useRef([]);
  const born = useRef(null);
  const violet = useMemo(() => new THREE.Color('#6142ff'), []);
  const obsidian = useMemo(() => new THREE.Color('#141414'), []);

  const plate = useMemo(() => roundedBox(32 * U, 32 * U, 0.7, 9 * U), []);
  const barGeos = useMemo(
    () =>
      BARS.map(({ height }) => {
        const g = roundedBox(4 * U, height * U, 0.34, 1.5 * U);
        // Origen en la base de la barra: así "crece" desde abajo al escalar en Y.
        g.translate(0, (height * U) / 2, 0);
        return g;
      }),
    [],
  );

  const plateMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#6142ff',
        metalness: 0.35,
        roughness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      }),
    [],
  );
  const barMats = useMemo(
    () =>
      BARS.map(
        ({ tone }) =>
          new THREE.MeshPhysicalMaterial({
            color: tone,
            metalness: 0.55,
            roughness: 0.18,
            clearcoat: 1,
            emissive: tone,
            emissiveIntensity: 0.18,
          }),
      ),
    [],
  );

  useFrame(({ clock }) => {
    if (born.current === null) born.current = clock.elapsedTime;
    const t = clock.elapsedTime - born.current;
    // Sobre el fondo violeta de "Qué es" el cuadro pasa a obsidiana para no perderse.
    if (mixRef) plateMat.color.copy(violet).lerp(obsidian, mixRef.current);
    bars.current.forEach((mesh, i) => {
      if (!mesh) return;
      const local = reducedMotion ? 1 : Math.min(Math.max((t - 0.25 - i * 0.18) / 0.7, 0), 1);
      mesh.scale.y = Math.max(easeOutBack(local), 0.001);
    });
  });

  return (
    <group>
      <mesh geometry={plate} material={plateMat} />
      {BARS.map(({ x }, i) => (
        <mesh
          key={x}
          ref={(el) => (bars.current[i] = el)}
          geometry={barGeos[i]}
          material={barMats[i]}
          position={[(x - 16) * U, (16 - BASE_Y) * U, 0.42]}
        />
      ))}
    </group>
  );
}
