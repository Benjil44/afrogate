import { useEffect, useRef } from 'react';
import { isOverlayOpen } from '@/components/overlay';
import { usePlayer } from './player';

/**
 * Global player shortcuts (design §3). Physical keys (`event.code`) for letters, so they work
 * with a Persian keyboard layout too. Arrow keys are NOT mirrored: Right always seeks forward in
 * both directions, matching the LTR timeline island.
 *
 *   Space / K  play-pause        Left / Right   seek -/+10 s
 *   Shift+Left/Right, P / N      previous / next track
 *   Up / Down  volume ±5 % (not inside a scrolling list)
 *   M mute · S shuffle · R repeat · ? help
 *
 * Ignored while typing, with Ctrl/Meta/Alt, and while a sheet or dialog is open (they own Esc and
 * Tab). Space on a focused button/link is left to the browser (it activates that control).
 */
export function useShortcuts(onHelp: () => void) {
  const player = usePlayer();
  const ref = useRef(player);
  ref.current = player;
  const helpRef = useRef(onHelp);
  helpRef.current = onHelp;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isOverlayOpen()) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
      const p = ref.current;
      const onControl = Boolean(target?.closest('button, a[href], summary, [role="button"]'));
      const inList = Boolean(target?.closest('[data-scroll-list]'));

      if (e.key === '?' || (e.code === 'Slash' && e.shiftKey)) {
        helpRef.current();
      } else if (e.code === 'Space') {
        if (onControl) return;
        p.toggle();
      } else if (e.code === 'KeyK') {
        p.toggle();
      } else if (e.key === 'ArrowRight') {
        if (e.shiftKey) p.next();
        else p.seekBy(10);
      } else if (e.key === 'ArrowLeft') {
        if (e.shiftKey) p.prev();
        else p.seekBy(-10);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (inList) return;
        p.setVolume((p.muted ? 0 : p.volume) + (e.key === 'ArrowUp' ? 0.05 : -0.05));
      } else if (e.code === 'KeyN') {
        p.next();
      } else if (e.code === 'KeyP') {
        p.prev();
      } else if (e.code === 'KeyM') {
        p.toggleMute();
      } else if (e.code === 'KeyS') {
        p.toggleShuffle();
      } else if (e.code === 'KeyR') {
        p.cycleRepeat();
      } else {
        return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
