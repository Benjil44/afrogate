/**
 * Adapted from React Bits "Waves" (2D-canvas version), TS-Tailwind variant:
 * https://github.com/DavidHDev/react-bits/blob/c83b5e7e02/src/ts-tailwind/Backgrounds/Waves/Waves.tsx
 * Copyright (c) David Haz — MIT + Commons Clause License Condition v1.0
 * (https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md). Used as part of this website;
 * the component is not redistributed on its own. The Perlin noise table is the classic
 * reference permutation (Ken Perlin, public domain).
 *
 * Afrows adaptations (docs/landing-wave-station-motion.md §2.1): no dependencies, device-pixel
 * ratio capped at 1.5, pauses when the tab is hidden or the hero leaves the viewport, `lite` tier
 * runs at 30 fps with lower density and no pointer attraction, no cursor dot, ResizeObserver
 * instead of window resize, line colour from the `--primary` token, fade-in on mount via CSS.
 */
import { useEffect, useRef } from 'react';
import type { MotionTier } from '../tier';

const GRADS: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0, 1], [0, -1],
];
const P = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240,
  21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88,
  237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83,
  111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216,
  80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186,
  3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58,
  17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
  129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193,
  238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
  184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128,
  195, 78, 66, 215, 61, 156, 180,
];

/** 2D Perlin noise with a seeded permutation table. */
class Noise {
  private perm = new Array<number>(512);
  private gradP = new Array<readonly [number, number]>(512);

  constructor(seed: number) {
    let s = Math.floor(seed * 65536);
    if (s < 256) s |= s << 8;
    for (let i = 0; i < 256; i++) {
      const v = i & 1 ? P[i] ^ (s & 255) : P[i] ^ ((s >> 8) & 255);
      this.perm[i] = this.perm[i + 256] = v;
      this.gradP[i] = this.gradP[i + 256] = GRADS[v % 12];
    }
  }

  private static fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  perlin2(x: number, y: number): number {
    let X = Math.floor(x);
    let Y = Math.floor(y);
    x -= X;
    y -= Y;
    X &= 255;
    Y &= 255;
    const dot = (g: readonly [number, number], dx: number, dy: number) => g[0] * dx + g[1] * dy;
    const n00 = dot(this.gradP[X + this.perm[Y]], x, y);
    const n01 = dot(this.gradP[X + this.perm[Y + 1]], x, y - 1);
    const n10 = dot(this.gradP[X + 1 + this.perm[Y]], x - 1, y);
    const n11 = dot(this.gradP[X + 1 + this.perm[Y + 1]], x - 1, y - 1);
    const u = Noise.fade(x);
    const v = Noise.fade(y);
    const lerp = (a: number, b: number, t: number) => (1 - t) * a + t * b;
    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
  }
}

interface Point {
  x: number;
  y: number;
  wx: number;
  wy: number;
  cx: number;
  cy: number;
  vx: number;
  vy: number;
}

const TIER_CONFIG = {
  full: { xGap: 14, yGap: 38, pointer: true, frameSkip: 1 },
  lite: { xGap: 22, yGap: 52, pointer: false, frameSkip: 2 },
} as const;

const WAVE = { speedX: 0.0125, speedY: 0.005, ampX: 32, ampY: 16, friction: 0.925, tension: 0.005, maxCursorMove: 100 };
const MAX_DPR = 1.5;

export default function Waves({ tier, className = '' }: { tier: Exclude<MotionTier, 'static'>; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tierRef = useRef(tier);
  tierRef.current = tier;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!container || !canvas || !ctx) return;

    const noise = new Noise(Math.random());
    const bounds = { width: 0, height: 0, left: 0, top: 0 };
    const mouse = { x: -10, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, vs: 0, a: 0, set: false };
    let lines: Point[][] = [];
    let raf = 0;
    let frame = 0;
    let visible = true;
    let strokeStyle = '';

    const resolveColor = () => {
      // The brand token is oklch; modern canvases parse it, older ones fall back to a close hex.
      const token = getComputedStyle(container).getPropertyValue('--primary').trim();
      ctx.strokeStyle = '#000';
      ctx.strokeStyle = token;
      strokeStyle = ctx.strokeStyle === '#000000' ? '#d9469a' : token;
    };

    const setSize = () => {
      const rect = container.getBoundingClientRect();
      bounds.width = rect.width;
      bounds.height = rect.height;
      bounds.left = rect.left;
      bounds.top = rect.top;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const setLines = () => {
      const { xGap, yGap } = TIER_CONFIG[tierRef.current];
      const { width, height } = bounds;
      const totalLines = Math.ceil((width + 200) / xGap);
      const totalPoints = Math.ceil((height + 30) / yGap);
      const xStart = (width - xGap * totalLines) / 2;
      const yStart = (height - yGap * totalPoints) / 2;
      lines = [];
      for (let i = 0; i <= totalLines; i++) {
        const pts: Point[] = [];
        for (let j = 0; j <= totalPoints; j++) {
          pts.push({ x: xStart + xGap * i, y: yStart + yGap * j, wx: 0, wy: 0, cx: 0, cy: 0, vx: 0, vy: 0 });
        }
        lines.push(pts);
      }
    };

    const movePoints = (time: number) => {
      const { speedX, speedY, ampX, ampY, friction, tension, maxCursorMove } = WAVE;
      const pointer = TIER_CONFIG[tierRef.current].pointer && mouse.set;
      for (const pts of lines) {
        for (const p of pts) {
          const move = noise.perlin2((p.x + time * speedX) * 0.002, (p.y + time * speedY) * 0.0015) * 12;
          p.wx = Math.cos(move) * ampX;
          p.wy = Math.sin(move) * ampY;
          if (pointer) {
            const dx = p.x - mouse.sx;
            const dy = p.y - mouse.sy;
            const dist = Math.hypot(dx, dy);
            const l = Math.max(175, mouse.vs);
            if (dist < l) {
              const f = Math.cos(dist * 0.001) * (1 - dist / l);
              p.vx += Math.cos(mouse.a) * f * l * mouse.vs * 0.00065;
              p.vy += Math.sin(mouse.a) * f * l * mouse.vs * 0.00065;
            }
            p.vx += -p.cx * tension;
            p.vy += -p.cy * tension;
            p.vx *= friction;
            p.vy *= friction;
            p.cx = Math.min(maxCursorMove, Math.max(-maxCursorMove, p.cx + p.vx * 2));
            p.cy = Math.min(maxCursorMove, Math.max(-maxCursorMove, p.cy + p.vy * 2));
          }
        }
      }
    };

    const drawLines = () => {
      ctx.clearRect(0, 0, bounds.width, bounds.height);
      ctx.beginPath();
      ctx.strokeStyle = strokeStyle;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      for (const pts of lines) {
        const last = pts.length - 1;
        ctx.moveTo(pts[0].x + pts[0].wx, pts[0].y + pts[0].wy);
        for (let i = 1; i <= last; i++) {
          const p = pts[i];
          const cursor = i === last ? 0 : 1;
          ctx.lineTo(p.x + p.wx + p.cx * cursor, p.y + p.wy + p.cy * cursor);
        }
      }
      ctx.stroke();
    };

    const tick = (t: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      frame++;
      if (frame % TIER_CONFIG[tierRef.current].frameSkip === 0) {
        mouse.sx += (mouse.x - mouse.sx) * 0.1;
        mouse.sy += (mouse.y - mouse.sy) * 0.1;
        const dx = mouse.x - mouse.lx;
        const dy = mouse.y - mouse.ly;
        const d = Math.hypot(dx, dy);
        mouse.vs = Math.min(100, mouse.vs + (d - mouse.vs) * 0.1);
        mouse.lx = mouse.x;
        mouse.ly = mouse.y;
        mouse.a = Math.atan2(dy, dx);
        movePoints(t);
        drawLines();
      }
      raf = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick);
    };

    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX - bounds.left;
      mouse.y = e.clientY - bounds.top;
      if (!mouse.set) {
        mouse.sx = mouse.lx = mouse.x;
        mouse.sy = mouse.ly = mouse.y;
        mouse.set = true;
      }
    };

    const onResize = () => {
      setSize();
      setLines();
      resolveColor();
      wake();
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);
    const intersection = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        wake();
      },
      { threshold: 0.05 },
    );
    intersection.observe(container);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    onResize();

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return (
    <div ref={containerRef} aria-hidden="true" className={`waves-wrap pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
