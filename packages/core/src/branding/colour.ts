// Colour conversions for the brand colour: hex is the stored and rendered form (lower case, six digits); HSL is how
// the per-theme variant moves lightness; HSV is the drag picker's model (saturation/value area plus hue).

export const HEX_COLOUR = /^#[0-9a-f]{6}$/;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

// Hue in degrees [0, 360); the other channels in percent [0, 100].
export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export interface Hsv {
  h: number;
  s: number;
  v: number;
}

export function isHexColour(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOUR.test(value);
}

export function hexToRgb(hex: string): Rgb {
  if (!isHexColour(hex)) throw new RangeError(`Not a #rrggbb colour: ${JSON.stringify(hex)}`);
  const channel = (index: number) => Number.parseInt(hex.slice(index, index + 2), 16);
  return { r: channel(1), g: channel(3), b: channel(5) };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const channel = (value: number) =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

// The hue shared by HSL and HSV, from the largest and smallest channel (0 for a grey).
function hueOf({ r, g, b }: Rgb, max: number, delta: number): number {
  if (delta === 0) return 0;
  const sector = max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return (sector * 60 + 360) % 360;
}

function unit(rgb: Rgb): { rgb: Rgb; max: number; min: number } {
  const scaled = { r: rgb.r / 255, g: rgb.g / 255, b: rgb.b / 255 };
  return { rgb: scaled, max: Math.max(scaled.r, scaled.g, scaled.b), min: Math.min(scaled.r, scaled.g, scaled.b) };
}

export function hexToHsl(hex: string): Hsl {
  const { rgb, max, min } = unit(hexToRgb(hex));
  const delta = max - min;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h: hueOf(rgb, max, delta), s: s * 100, l: l * 100 };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  return fromChroma(h, chroma, lightness - chroma / 2);
}

export function hexToHsv(hex: string): Hsv {
  const { rgb, max, min } = unit(hexToRgb(hex));
  const delta = max - min;
  return { h: hueOf(rgb, max, delta), s: max === 0 ? 0 : (delta / max) * 100, v: max * 100 };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const value = v / 100;
  const chroma = value * (s / 100);
  return fromChroma(h, chroma, value - chroma);
}

// The standard hexcone construction shared by HSL and HSV: the chroma placed by hue sector, then lifted by `match`.
function fromChroma(hue: number, chroma: number, match: number): string {
  const h = (((hue % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((h % 2) - 1));
  const [r, g, b] =
    h < 1 ? [chroma, x, 0] : h < 2 ? [x, chroma, 0] : h < 3 ? [0, chroma, x] : h < 4 ? [0, x, chroma] : h < 5 ? [x, 0, chroma] : [chroma, 0, x];
  return rgbToHex({ r: (r + match) * 255, g: (g + match) * 255, b: (b + match) * 255 });
}
