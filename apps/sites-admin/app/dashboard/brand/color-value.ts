const HEX_COLOR = /^#[0-9A-F]{6}$/;

export function normalizeHex(value: string): string {
  const compact = value.trim().toUpperCase();
  if (!compact) return compact;
  return compact.startsWith("#") ? compact : `#${compact}`;
}

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

export function initialColor(value: string, fallback: string): { text: string; valid: string } {
  const normalized = normalizeHex(value);
  const valid = isHexColor(normalized) ? normalized : normalizeHex(fallback);
  return { text: valid, valid };
}
