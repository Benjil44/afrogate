import { useEffect, useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import { IconButton } from '@/components/transport';
import { fill, useLang } from '@/i18n';
import { trackShareUrl } from '@/lib/route';
import type { Track } from '@/lib/tracks';
import { cn } from '@/lib/utils';

/** Clipboard API first; the hidden-textarea copy covers older / non-secure contexts. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Share a track: `#/track/<id>` link (opens the track page, plays on the first tap). The native
 * share sheet where available (phones), else copy the link; the result is shown in a small bubble
 * that is also a polite live region. If copying fails too, the link itself is shown to copy by hand.
 */
export function ShareButton({ track, size, className }: { track: Track; size?: 'sm' | 'md'; className?: string }) {
  const { t } = useLang();
  const [message, setMessage] = useState('');
  const timerRef = useRef(0);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const show = (text: string, ms: number) => {
    window.clearTimeout(timerRef.current);
    setMessage(text);
    timerRef.current = window.setTimeout(() => setMessage(''), ms);
  };

  const share = async () => {
    if (!track.src) return;
    const url = trackShareUrl(track.id);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: track.title, text: track.artist ? `${track.title} — ${track.artist}` : track.title, url });
        return;
      } catch (err) {
        const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '';
        if (name === 'AbortError') return; // the listener closed the share sheet
      }
    }
    if (await copyText(url)) show(t.app.linkCopied, 2500);
    else show(fill(t.app.copyThisLink, { url }), 12000);
  };

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <IconButton label={fill(t.app.shareTrack, { title: track.title })} size={size} disabled={!track.src} onClick={() => void share()} className="text-[var(--muted-foreground)]">
        <Share2 className="h-5 w-5" aria-hidden="true" />
      </IconButton>
      <span
        role="status"
        className={
          message
            ? 'absolute end-0 top-full z-40 mt-1 w-max max-w-64 select-text break-all rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs font-semibold text-[var(--foreground)] shadow-lg'
            : 'sr-only'
        }
      >
        {message}
      </span>
    </span>
  );
}
