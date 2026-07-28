import { useEffect, useState, type FormEvent } from 'react';
import { Coins } from 'lucide-react';
import { fetchGbPrice, updateGbPrice, type GbPriceSummary } from '../api/reseller-pricing';
import { PanelHeading, StatusBadge } from '../components/primitives';
import { SettingsInput } from '../components/settings-form';
import { formatMoneyAmount } from '../labels';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { mutedTextClass, panelClass, primaryButtonClass } from '../ui-classes';

/**
 * Superadmin "Price per GB" control: the single platform cost per GB every
 * seller sale is charged at (see docs/reseller-per-gb-pricing-plan.md).
 */
export function GbPricePanel({
  canEdit,
  format,
  sessionToken,
  t,
}: {
  /** Only superadmin may change the price; others see it read-only. */
  canEdit: boolean;
  format: DashboardFormatters;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const s = t.billing;
  const [price, setPrice] = useState<GbPriceSummary | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoadFailed(false);
    fetchGbPrice(sessionToken, controller.signal)
      .then((summary) => {
        setPrice(summary);
        setAmountInput(String(summary.amount));
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadFailed(true);
      });
    return () => controller.abort();
  }, [sessionToken]);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) return;

    const amount = Math.round(Number(amountInput));
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage(s.gbPriceInvalid);
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const saved = await updateGbPrice(sessionToken, amount);
      setPrice(saved);
      setAmountInput(String(saved.amount));
      setLoadFailed(false);
      setMessage(s.gbPriceSaved);
    } catch {
      setMessage(s.gbPriceSaveFailed);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className={panelClass} data-gb-price-panel="true">
      <PanelHeading
        icon={Coins}
        meta={price ? `${s.gbPriceCurrent}: ${formatMoneyAmount(price.amount, price.currency, format)}` : loadFailed ? s.gbPriceLoadFailed : t.dataStatus.loading}
        title={s.gbPriceSetting}
      />
      <p className={`${mutedTextClass} mt-2`}>{s.gbPriceSettingHint}</p>
      <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={handleSave}>
        <div className="w-full max-w-[220px]">
          <SettingsInput
            disabled={!canEdit}
            inputMode="numeric"
            label={`${s.gbPriceNew}${price ? ` (${price.currency})` : ''}`}
            onChange={setAmountInput}
            value={amountInput}
          />
        </div>
        <button className={`${primaryButtonClass} min-h-10`} disabled={!canEdit || isSaving} type="submit">
          {isSaving ? s.gbPriceSaving : s.gbPriceSave}
        </button>
        {message ? <span className={mutedTextClass}>{message}</span> : null}
        {!canEdit ? <StatusBadge tone="warning">{s.gbPriceSuperadminOnly}</StatusBadge> : null}
      </form>
    </section>
  );
}
