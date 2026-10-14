import { createElement, useRef, type ElementType } from 'react';
import { useLang } from '@/i18n';
import { isBelowFold } from './tier';
import { DUR, EASE, STAGGER } from './tokens';
import { useFx } from './use-fx';

/**
 * Heading whose words rise into view once (§3.5). Words only — never chars: Persian letter
 * joining and ZWNJ break on char splits. `aria: 'auto'` keeps the whole string on the element
 * for screen readers. Keyed by language so React remounts it instead of reconciling over the
 * spans SplitText injects, and the split is reverted as soon as the tween completes so
 * `text-wrap: balance` and bidi punctuation render natively afterwards.
 */
export function SplitWords({
  as = 'h2',
  text,
  className,
  id,
}: {
  as?: ElementType;
  text: string;
  className?: string;
  id?: string;
}) {
  const { lang } = useLang();
  const ref = useRef<HTMLElement>(null);

  useFx(
    ref,
    ({ gsap, SplitText, ctx }) => {
      let split: InstanceType<typeof SplitText> | null = null;
      let live = true;
      document.fonts.ready.then(() => {
        const el = ref.current;
        if (!live || !el || !isBelowFold(el)) return;
        ctx.add(() => {
          split = SplitText.create(el, { type: 'words', wordsClass: 'w', aria: 'auto' });
          const words = split.words;
          gsap.from(words, {
            yPercent: 60,
            opacity: 0,
            duration: DUR.words,
            ease: EASE.out,
            stagger: words.length > 12 ? { amount: 0.5 } : { each: STAGGER.words },
            scrollTrigger: { trigger: el, start: 'top 85%', once: true },
            onComplete: () => {
              split?.revert();
              split = null;
            },
          });
        });
      });
      return () => {
        live = false;
        split?.revert();
      };
    },
    [lang],
  );

  return createElement(as, { ref, className, id, key: lang }, text);
}
