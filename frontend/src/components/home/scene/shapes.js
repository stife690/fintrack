import * as THREE from 'three';

/**
 * Rectángulo de esquinas redondeadas centrado en el origen, para extruirlo.
 * @param {number} w Ancho.
 * @param {number} h Alto.
 * @param {number} r Radio de las esquinas.
 */
export function roundedRectShape(w, h, r) {
  const x = -w / 2;
  const y = -h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/**
 * Caja de bordes suaves (extrusión con bisel), centrada en el origen.
 * @param {number} w Ancho.
 * @param {number} h Alto.
 * @param {number} d Profundidad.
 * @param {number} [r] Radio de las esquinas.
 */
export function roundedBox(w, h, d, r = Math.min(w, h) * 0.18) {
  const bevel = Math.min(r * 0.6, d * 0.3);
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w - bevel * 2, h - bevel * 2, Math.max(r - bevel, 0.001)), {
    depth: d - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 6,
  });
  geo.translate(0, 0, -(d - bevel * 2) / 2);
  return geo;
}
