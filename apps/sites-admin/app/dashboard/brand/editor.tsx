"use client";
import { useState, type CSSProperties } from "react";
import { themeKeys, themePresets, resolveTheme, themeVariables, type ThemeKey } from "@adash/site-themes";
import { saveBrand } from "../../actions";
import { initialColor, isHexColor, normalizeHex } from "./color-value";

type ColorName = "Primary" | "Secondary" | "Accent";
type ColorState = { text: string; valid: string };

function ColorField({ name, label, help, value, onChange }: { name: "primaryColor" | "secondaryColor" | "accentColor"; label: ColorName; help: string; value: ColorState; onChange: (next: ColorState) => void }) {
  const inputId = `${name}-hex`;
  const pickerId = `${name}-picker`;
  const helpId = `${name}-help`;
  const errorId = `${name}-error`;
  const valid = isHexColor(value.text);

  function changeText(text: string) {
    const normalized = normalizeHex(text);
    onChange({ text: normalized, valid: isHexColor(normalized) ? normalized : value.valid });
  }

  function changePicker(color: string) {
    const normalized = normalizeHex(color);
    onChange({ text: normalized, valid: normalized });
  }

  return <fieldset className="color-field" aria-describedby={`${helpId}${valid ? "" : ` ${errorId}`}`}>
    <legend>{label} color</legend>
    <div className="color-control-row">
      <label className="color-picker-label" htmlFor={pickerId}>
        <span className="sr-only">Choose {label.toLowerCase()} color</span>
        <input id={pickerId} className="color-picker" type="color" value={value.valid} onChange={event => changePicker(event.target.value)} aria-label={`Choose ${label.toLowerCase()} color`} />
        <span className="color-swatch" style={{ backgroundColor: value.valid }} aria-hidden="true" />
      </label>
      <label className="hex-label" htmlFor={inputId}>
        <span>HEX value</span>
        <input id={inputId} className="hex-input" value={value.text} onChange={event => changeText(event.target.value)} inputMode="text" autoCapitalize="characters" spellCheck={false} maxLength={7} aria-invalid={!valid} aria-describedby={`${helpId}${valid ? "" : ` ${errorId}`}`} />
      </label>
      <input type="hidden" name={name} value={value.valid} />
    </div>
    <small id={helpId} className="field-help">{help}</small>
    {!valid && <small id={errorId} className="field-error" role="alert">Enter a 6-digit HEX color in the format #RRGGBB. The last valid color remains in the preview.</small>}
  </fieldset>;
}

export function BrandEditor({ themeKey: initialTheme, primary, secondary, accent }: { themeKey: string; primary: string; secondary: string; accent: string; logoUrl?: string }) {
  const startingKey = initialTheme as ThemeKey;
  const safeStartingKey = startingKey in themePresets ? startingKey : themeKeys[0];
  const startingPreset = themePresets[safeStartingKey];
  const [themeKey, setThemeKey] = useState<ThemeKey>(safeStartingKey);
  const [primaryColor, setPrimary] = useState<ColorState>(() => initialColor(primary, startingPreset.primary));
  const [secondaryColor, setSecondary] = useState<ColorState>(() => initialColor(secondary, startingPreset.secondary));
  const [accentColor, setAccent] = useState<ColorState>(() => initialColor(accent, startingPreset.accent));
  const theme = resolveTheme(themeKey, { primaryColor: primaryColor.valid, secondaryColor: secondaryColor.valid, accentColor: accentColor.valid });
  const invalidHex = !isHexColor(primaryColor.text) || !isHexColor(secondaryColor.text) || !isHexColor(accentColor.text);
  const rejected = theme && (theme.primary.toLowerCase() !== primaryColor.valid.toLowerCase() || theme.secondary.toLowerCase() !== secondaryColor.valid.toLowerCase() || theme.accent.toLowerCase() !== accentColor.valid.toLowerCase());

  function applyDefaults(key: ThemeKey) {
    const preset = themePresets[key];
    setPrimary({ text: preset.primary, valid: preset.primary });
    setSecondary({ text: preset.secondary, valid: preset.secondary });
    setAccent({ text: preset.accent, valid: preset.accent });
  }

  return <div className="split"><form className="panel" action={saveBrand}><h2>Your look</h2><p className="field-help">Your template sets the page layout. The theme sets its visual style, including fonts, colour, and mood.</p><label>Theme preset<select name="themeKey" value={themeKey} onChange={event => { const next = event.target.value as ThemeKey; setThemeKey(next); applyDefaults(next); }}>{themeKeys.map(item => <option key={item} value={item}>{themePresets[item].name}</option>)}</select><small className="field-help">Choose the overall look, then check the preview beside this form.</small></label><button type="button" className="secondary reset-theme-colors" onClick={() => applyDefaults(themeKey)}>Reset to theme defaults</button><div className="color-fields"><ColorField name="primaryColor" label="Primary" help="Used for major brand elements and primary actions." value={primaryColor} onChange={setPrimary} /><ColorField name="secondaryColor" label="Secondary" help="Used for supporting backgrounds and secondary elements." value={secondaryColor} onChange={setSecondary} /><ColorField name="accentColor" label="Accent" help="Used for highlights, badges and emphasis." value={accentColor} onChange={setAccent} /></div>{rejected && <p role="alert" className="notice">One or more colors reduce text contrast. Choose stronger contrast before saving.</p>}<p className="hint">Logo and app icon are selected from the media library below.</p><button disabled={invalidHex || Boolean(rejected)}>Save brand</button></form><div className="panel"><h2>Live preview</h2>{theme && <div className="theme-preview" style={themeVariables(theme) as CSSProperties}><p className="eyebrow">{themePresets[themeKey].name}</p><h3>Made to feel like you.</h3><p>Representative heading, body copy, and product card.</p><div className="preview-card"><span>Featured</span><h4>Signature product</h4><p>A thoughtful addition to your collection.</p><button type="button">Primary button</button></div></div>}<p className="hint">Public theme changes when you save. Content images and words require publishing.</p></div></div>;
}
