import { RefreshCw } from 'lucide-react';
import { PanelState } from './EmptyState';

/**
 * Shared error-state primitive: localized error message, optional description,
 * and an optional retry callback rendered as an inline action button.
 * Pass `retryLabel` from the typed en/fa layer (e.g. `t.actions.retry`).
 */
export function ErrorState({
  detail,
  message,
  onRetry,
  retryLabel,
}: {
  detail?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <PanelState
      action={onRetry && retryLabel ? { icon: RefreshCw, label: retryLabel, onClick: onRetry } : undefined}
      detail={detail}
      kind="error"
      title={message}
    />
  );
}
