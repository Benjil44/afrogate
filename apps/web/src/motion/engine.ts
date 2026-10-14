/**
 * The only file that imports gsap / lenis. Loaded lazily by MotionProvider (Vite chunk "fx")
 * after first paint and only when the tier is not `static`.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);
ScrollTrigger.config({ ignoreMobileResize: true, limitCallbacks: true });

export interface Engine {
  gsap: typeof gsap;
  ScrollTrigger: typeof ScrollTrigger;
  SplitText: typeof SplitText;
  /** Desktop-only smooth scroll (§1.6): the caller owns the returned instance. */
  createLenis(): Lenis;
}

export type { Lenis };

export const engine: Engine = {
  gsap,
  ScrollTrigger,
  SplitText,
  createLenis() {
    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true, syncTouch: false });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    const destroy = lenis.destroy.bind(lenis);
    lenis.destroy = () => {
      gsap.ticker.remove(tick);
      destroy();
    };
    return lenis;
  },
};
