import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useLang, APP_URL } from '@/i18n';

export function PromoBar() {
  const { t } = useLang();
  const [open, setOpen] = useState(true);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="animate-gradient-bg relative w-full overflow-hidden bg-[linear-gradient(90deg,var(--primary),var(--secondary),var(--primary))]"
        >
          <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-10 py-2 text-sm text-white">
            <span className="animate-blink inline-flex h-2 w-2 shrink-0 rounded-full bg-white" />
            <span className="hidden rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider sm:inline">
              {t.promo.tag}
            </span>
            <span className="animate-blink font-extrabold tracking-wide drop-shadow">{t.promo.text}</span>
            <a
              href={APP_URL}
              className="ml-1 shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0a0a0f] transition hover:brightness-90"
            >
              {t.promo.cta}
            </a>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Dismiss"
              className="absolute end-3 top-1/2 -translate-y-1/2 text-white/80 transition hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
