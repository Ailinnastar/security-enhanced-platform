import { useState, useEffect } from 'react';
import { applyUserPreferences, getStoredFontPx, getStoredAccent } from '../userPreferences';

export default function DisplaySettings() {
  const [open, setOpen] = useState(false);
  const [fontPx, setFontPx] = useState(15);
  const [accent, setAccent] = useState('#5865F2');

  useEffect(() => {
    if (!open) return;
    setFontPx(getStoredFontPx());
    setAccent(getStoredAccent());
  }, [open]);

  function save() {
    let hex = accent.trim();
    if (!hex.startsWith('#')) hex = `#${hex}`;
    const valid = /^#[a-f\d]{6}$/i.test(hex);
    if (!valid) {
      window.alert('Please use a full hex colour like #5865F2 (six digits after #).');
      return;
    }
    localStorage.setItem('sg_base_font_px', String(fontPx));
    localStorage.setItem('sg_accent_hex', hex);
    setAccent(hex);
    applyUserPreferences();
    setOpen(false);
  }

  function resetDefaults() {
    localStorage.removeItem('sg_base_font_px');
    localStorage.removeItem('sg_accent_hex');
    setFontPx(15);
    setAccent('#5865F2');
    applyUserPreferences();
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="display-settings-fab"
        onClick={() => setOpen(true)}
        title="Display settings: text size and accent colour"
        aria-label="Open display settings"
      >
        Aa
      </button>

      {open && (
        <div className="display-settings-overlay" onClick={() => setOpen(false)}>
          <div className="display-settings-panel" onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="display-settings-title">
            <h3 id="display-settings-title">Display</h3>
            <p className="display-settings-hint">These choices are saved in this browser only.</p>

            <div className="form-group">
              <label htmlFor="sg-font-range">Text size ({fontPx}px)</label>
              <input
                id="sg-font-range"
                type="range"
                min={12}
                max={22}
                step={1}
                value={fontPx}
                onChange={e => setFontPx(Number(e.target.value))}
              />
              <div className="display-settings-row">
                <span className="muted">Smaller</span>
                <span className="muted">Larger</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="sg-accent">Accent colour</label>
              <div className="display-settings-color-row">
                <input
                  id="sg-accent"
                  type="color"
                  value={accent}
                  onChange={e => setAccent(e.target.value)}
                  aria-label="Pick accent colour"
                />
                <input
                  type="text"
                  value={accent}
                  onChange={e => setAccent(e.target.value)}
                  spellCheck={false}
                  className="display-settings-hex"
                  maxLength={7}
                />
              </div>
              <p className="muted small">Used for buttons, links, and highlights across the app.</p>
            </div>

            <div className="display-settings-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} title="Close without saving changes">
                Cancel
              </button>
              <button type="button" className="btn btn-ghost" onClick={resetDefaults} title="Restore default text size and purple accent">
                Reset
              </button>
              <button type="button" className="btn btn-accent" onClick={save} title="Save display settings to this browser">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
