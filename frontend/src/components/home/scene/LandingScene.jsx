import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import LogoMark3D from './LogoMark3D';
import { Calculator, CalendarBlock, CoinStack, Padlock, PiggyBank, TrendArrow, useFinanceMaterials } from './FinanceObjects';

const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Figuras flotantes: posición en fracciones del ancho/alto visible, profundidad, escala,
 * velocidad de flotación y cuánto suben al hacer scroll (da la sensación de profundidad).
 * `mobile` marca las tres que se ven en celular.
 */
const FLOATERS = [
  { Comp: PiggyBank, at: [-0.4, 0.3], z: -1, scale: 0.85, speed: 0.9, drift: 0.55, mobile: true },
  { Comp: CoinStack, at: [0.4, 0.32], z: -0.6, scale: 0.75, speed: 1.1, drift: 0.8, mobile: true },
  { Comp: Calculator, at: [-0.43, -0.28], z: -0.4, scale: 0.75, speed: 0.8, drift: 0.35 },
  { Comp: Padlock, at: [0.18, -0.42], z: -1.6, scale: 0.7, speed: 1.2, drift: 0.65 },
  { Comp: TrendArrow, at: [0.43, -0.25], z: 0, scale: 0.85, speed: 1, drift: 0.45, mobile: true },
  { Comp: CalendarBlock, at: [-0.16, 0.42], z: -2.2, scale: 0.7, speed: 0.7, drift: 0.9 },
];

/** Reflejos de estudio para los metales (sin descargar un HDR). */
function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** Última lectura del scroll: el logo y las seis figuras la comparten dentro del mismo cuadro. */
const scrollCache = { at: -1, value: { travel: 0, dock: 0, total: 0 } };

/**
 * Progresos del scroll, medidos una sola vez por cuadro (`at` es el reloj de la escena):
 * `travel` (del hero a "Qué es"), `dock` (entrada de "Cómo funciona") y `total` (para las figuras).
 */
function readScroll(stage, at) {
  if (scrollCache.at === at) return scrollCache.value;
  scrollCache.at = at;
  scrollCache.value = measureScroll(stage);
  return scrollCache.value;
}

function measureScroll(stage) {
  const vh = window.innerHeight;
  const hero = stage?.querySelector('[data-stage="hero"]');
  const about = stage?.querySelector('[data-stage="about"]');
  const how = stage?.querySelector('[data-stage="how"]');
  if (!hero || !about || !how) return { travel: 0, dock: 0, total: 0 };
  // Medidas con getBoundingClientRect: no dependen de qué contenedor tenga `position`.
  const stageTop = stage.getBoundingClientRect().top;
  const y = -stageTop;
  const howTop = how.getBoundingClientRect().top - stageTop;
  const travel = clamp01(y / hero.offsetHeight);
  // `dock`: de 0 a 1 mientras "Cómo funciona" sube desde abajo hasta la mitad de la pantalla.
  const dock = clamp01((y - (howTop - vh * 0.95)) / (vh * 0.75));
  return { travel, dock, total: clamp01(y / howTop) };
}

/** Convierte el centro y el ancho de un elemento del DOM a coordenadas del lienzo 3D. */
function domToWorld(el, canvas, viewport) {
  const r = el.getBoundingClientRect();
  const c = canvas.getBoundingClientRect();
  return {
    x: ((r.left + r.width / 2 - c.left) / c.width - 0.5) * viewport.width,
    y: -((r.top + r.height / 2 - c.top) / c.height - 0.5) * viewport.height,
    width: (r.width / c.width) * viewport.width,
  };
}

/** Logo con su coreografía: arriba al centro en el hero, a la derecha en "Qué es", y sube al salir. */
function ChoreographedLogo({ stageRef, reducedMotion }) {
  const group = useRef();
  const mix = useRef(0);
  const { viewport, pointer, gl } = useThree();

  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;
    const stage = stageRef.current;
    const { travel, dock } = readScroll(stage, clock.elapsedTime);
    const k = easeInOut(travel);
    const d = easeInOut(dock);
    const wide = viewport.width > viewport.height * 1.1;
    const t = clock.elapsedTime;
    // Violeta en el hero, obsidiana sobre el violeta de "Qué es" y de nuevo violeta como ícono de la app.
    mix.current = clamp01((travel - 0.35) / 0.4) * (1 - d);

    // En pantallas anchas viaja a la derecha y crece; en celular se va pequeño a la esquina superior derecha.
    let targetX = lerp(0, viewport.width * (wide ? 0.22 : 0.3), k);
    let targetY = wide ? lerp(viewport.height * 0.25, 0, k) : lerp(viewport.height * 0.24, viewport.height * 0.36, k);
    let targetScale = (wide ? lerp(0.62, 1.05, k) : lerp(0.6, 0.32, k)) * Math.min(1, viewport.width / 6);

    // Detrás del texto mientras flota; por encima del contenido cuando entra al celular (si no,
    // la pantalla blanca lo taparía). La capa no recibe clics, así que no estorba.
    const layer = gl.domElement.closest('[data-scene-layer]');
    const z = d > 0.25 ? '20' : '0';
    if (layer && layer.style.zIndex !== z) layer.style.zIndex = z;

    // Aterrizaje: el logo baja hasta el hueco del celular y desde ahí lo sigue al hacer scroll.
    const slot = d > 0 ? stage?.querySelector('[data-logo-slot]') : null;
    if (slot) {
      const s = domToWorld(slot, gl.domElement, viewport);
      targetX = lerp(targetX, s.x, d);
      targetY = lerp(targetY, s.y, d);
      targetScale = lerp(targetScale, s.width / 3.2, d);
    }

    // Suavizado: el logo "persigue" su destino; ya acoplado al celular lo sigue casi sin retraso.
    const ease = 1 - Math.exp(-delta * (d > 0.98 ? 30 : 6));
    g.position.x += (targetX - g.position.x) * ease;
    g.position.y += (targetY - g.position.y) * ease;
    g.scale.setScalar(g.scale.x + (targetScale - g.scale.x) * ease);

    const sway = reducedMotion ? 0 : Math.sin(t * 0.6) * 0.32;
    g.rotation.y = (sway + k * Math.PI * 2 + pointer.x * 0.25) * (1 - d) + d * Math.PI * 2;
    g.rotation.x = ((reducedMotion ? 0 : Math.sin(t * 0.45) * 0.08) - pointer.y * 0.18) * (1 - d);
  });

  return (
    // Arranca en tamaño cero: el suavizado lo hace "aparecer" creciendo hasta su escala.
    <group ref={group} position={[0, 1.5, 0]} scale={0.001}>
      <LogoMark3D reducedMotion={reducedMotion} mixRef={mix} />
    </group>
  );
}

/** Una figura flotando: vaivén propio, se aparta del mouse y sube con el scroll a su ritmo. */
function Floater({ Comp, at, z, scale, speed, drift, index, stageRef, reducedMotion, materials }) {
  const group = useRef();
  const { viewport, pointer } = useThree();
  const phase = index * 1.37;
  const base = scale * (viewport.width < 6 ? 0.7 : 1);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const { total, dock } = readScroll(stageRef.current, clock.elapsedTime);
    const wide = viewport.width > viewport.height * 1.1;
    // Al llegar a "Cómo funciona" las figuras se encogen y desaparecen: el protagonista es el celular.
    g.scale.setScalar(base * (1 - easeInOut(dock)) + 0.0001);
    const fx = wide ? at[0] : at[0] * 1.15;
    const fy = wide ? at[1] : at[1] * 0.9 + (at[1] > 0 ? 0.05 : -0.05);
    const bob = reducedMotion ? 0 : Math.sin(t * speed + phase) * 0.12;

    g.position.set(
      fx * viewport.width - pointer.x * 0.35 * (1 + z * -0.2),
      fy * viewport.height + bob - pointer.y * 0.25 + total * viewport.height * drift,
      z,
    );
    g.rotation.y = reducedMotion ? 0.5 : t * 0.35 * speed + phase;
    g.rotation.x = reducedMotion ? 0.2 : Math.sin(t * 0.5 + phase) * 0.35;
    g.rotation.z = reducedMotion ? 0 : Math.cos(t * 0.4 + phase) * 0.15;
  });

  return (
    <group ref={group} scale={base}>
      <Comp m={materials} />
    </group>
  );
}

function Floaters({ stageRef, reducedMotion }) {
  const materials = useFinanceMaterials();
  const { viewport } = useThree();
  const narrow = viewport.width < viewport.height;
  const list = useMemo(() => FLOATERS.map((f, index) => ({ ...f, index })).filter((f) => !narrow || f.mobile), [narrow]);
  return list.map((f) => (
    <Floater key={f.index} {...f} stageRef={stageRef} reducedMotion={reducedMotion} materials={materials} />
  ));
}

/**
 * Escena 3D de la landing (se carga aparte, con `lazy`): el logo de FinTrack y las figuras.
 * @param {{ stageRef: React.RefObject<HTMLElement>, active: boolean, reducedMotion: boolean }} props
 */
export default function LandingScene({ stageRef, active, reducedMotion, onReady }) {
  return (
    <Canvas
      className="!absolute inset-0"
      frameloop={active ? 'always' : 'never'}
      dpr={[1, typeof window !== 'undefined' && window.innerWidth < 768 ? 1.25 : 1.75]}
      onCreated={onReady}
      camera={{ position: [0, 0, 12], fov: 35 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      aria-hidden="true"
    >
      <StudioEnvironment />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 6]} intensity={1.6} />
      <pointLight position={[-5, -3, 4]} intensity={40} color="#8b66ff" />
      <ChoreographedLogo stageRef={stageRef} reducedMotion={reducedMotion} />
      <Floaters stageRef={stageRef} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
