const FONT_KEY = 'sg_base_font_px';
const ACCENT_KEY = 'sg_accent_hex';

function parseHex(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || '').trim());
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function toHex(r, g, b) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function accentDerivatives(hex) {
  const rgb = parseHex(hex);
  if (!rgb) {
    return { hover: '#4752C4', light: '#7983f5' };
  }
  const hover = toHex(rgb.r * 0.78, rgb.g * 0.78, rgb.b * 0.78);
  const light = toHex(
    rgb.r + (255 - rgb.r) * 0.38,
    rgb.g + (255 - rgb.g) * 0.38,
    rgb.b + (255 - rgb.b) * 0.38
  );
  return { hover, light };
}

/** Apply font size + accent from localStorage (safe defaults). */
export function applyUserPreferences() {
  const root = document.documentElement;
  let px = parseInt(localStorage.getItem(FONT_KEY), 10);
  if (Number.isNaN(px)) px = 15;
  px = Math.min(22, Math.max(12, px));

  let accent = (localStorage.getItem(ACCENT_KEY) || '#5865F2').trim();
  if (!accent.startsWith('#')) accent = `#${accent}`;
  if (!parseHex(accent)) accent = '#5865F2';
  const { hover, light } = accentDerivatives(accent);

  root.style.setProperty('--sg-base-font', `${px}px`);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-hover', hover);
  root.style.setProperty('--accent-light', light);
}

export function getStoredFontPx() {
  let px = parseInt(localStorage.getItem(FONT_KEY), 10);
  if (Number.isNaN(px)) px = 15;
  return Math.min(22, Math.max(12, px));
}

export function getStoredAccent() {
  return localStorage.getItem(ACCENT_KEY) || '#5865F2';
}
