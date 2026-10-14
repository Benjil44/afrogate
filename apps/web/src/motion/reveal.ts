import type { Engine } from './engine';
import { DUR, EASE, STAGGER } from './tokens';
import { isBelowFold } from './tier';

/**
 * `[data-fx="rise"]` reveal convention (§1.5): one batched ScrollTrigger for every element.
 * The hidden state is applied here (never in CSS) and only to elements below the fold, so a
 * page without JS — or on the `static` tier — is complete and readable.
 *
 *   <li data-fx="rise" data-fx-y="40" data-fx-delay="0.08">…</li>
 */
const DONE = 'data-fx-done';

export function registerReveals({ gsap, ScrollTrigger }: Engine): () => void {
  const pending = Array.from(document.querySelectorAll<HTMLElement>(`[data-fx="rise"]:not([${DONE}])`));
  const hidden: HTMLElement[] = [];
  for (const el of pending) {
    if (isBelowFold(el)) hidden.push(el);
    else el.setAttribute(DONE, '');
  }
  if (hidden.length === 0) return () => {};

  for (const el of hidden) gsap.set(el, { opacity: 0, y: Number(el.dataset.fxY ?? 24) });

  const triggers = ScrollTrigger.batch(hidden, {
    start: 'top 88%',
    once: true,
    interval: 0.08,
    onEnter: (els) => {
      const list = els as HTMLElement[];
      list.forEach((el) => el.setAttribute(DONE, ''));
      gsap.to(list, {
        opacity: 1,
        y: 0,
        duration: DUR.reveal,
        ease: EASE.out,
        stagger: STAGGER.card,
        delay: Number(list[0]?.dataset.fxDelay ?? 0),
        clearProps: 'transform,opacity',
      });
    },
  });

  return () => {
    triggers.forEach((t) => t.kill());
    // Never leave content hidden (tier switched to static / provider unmounted).
    gsap.set(
      hidden.filter((el) => !el.hasAttribute(DONE)),
      { clearProps: 'transform,opacity' },
    );
    hidden.forEach((el) => el.setAttribute(DONE, ''));
  };
}

/** Toggle `is-offscreen` on `el` so CSS loops (marquee, rings) pause when it is not in view. */
export function watchOnscreen({ ScrollTrigger }: Engine, el: Element) {
  return ScrollTrigger.create({
    trigger: el,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => el.classList.toggle('is-offscreen', !self.isActive),
  });
}
