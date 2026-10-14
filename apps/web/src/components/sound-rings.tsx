/**
 * Three concentric "sound" rings behind the CTA button (motion spec §2.7). Pure CSS: they leave
 * on the beat while the demo player is playing; the section toggles `is-offscreen` to pause
 * them off screen, and the `static` tier freezes them as a still glyph.
 */
export function SoundRings() {
  return (
    <span aria-hidden="true" className="sound-rings pointer-events-none absolute inset-0 grid place-items-center">
      <span className="ring ring-1" />
      <span className="ring ring-2" />
      <span className="ring ring-3" />
    </span>
  );
}
