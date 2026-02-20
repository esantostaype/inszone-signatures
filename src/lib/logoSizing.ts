// src/lib/logoSizing.ts
export type LogoSize = { w: number; h: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Regla "inteligente" para tamaño visual del logo (NO modifica la imagen),
 * solo devuelve el tamaño con el que se renderiza.
 *
 * Reglas:
 * - ~1:1 => 64x64
 * - ~2:1 => 90x45
 * - ~3:1 => 110x35
 * - otros => fallback por maxW y altura calculada
 */
export function getSmartLogoSize(srcW?: number, srcH?: number): LogoSize {
  if (!srcW || !srcH) return { w: 64, h: 64 };

  const ar = srcW / srcH;

  // 1:1 (acepta un margen)
  if (ar >= 0.9 && ar <= 1.1) return { w: 64, h: 64 };

  // 2:1 (margen)
  if (ar > 1.1 && ar <= 2.3) return { w: 90, h: 45 };

  // 3:1 (margen)
  if (ar > 2.3 && ar <= 3.6) return { w: 110, h: 35 };

  // Por si te suben un logo vertical (0.5:1, etc.)
  if (ar < 0.9) return { w: 45, h: 90 };

  if (ar > 3.6 && ar <= 4.6) return { w: 140, h: 28 };

  // Fallback: limita ancho y calcula alto
  const maxW = 140;   // ajusta si quieres
  const minH = 28;
  const maxH = 96;

  const h = clamp(Math.round(maxW / ar), minH, maxH);
  return { w: maxW, h };
}