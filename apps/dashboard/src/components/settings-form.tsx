import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function SettingsInput({
  autoComplete,
  disabled = false,
  inputMode,
  label,
  onChange,
  placeholder,
  required = false,
  revealable = false,
  revealLabels,
  type = 'text',
  value,
}: {
  autoComplete?: string;
  disabled?: boolean;
  inputMode?: 'numeric';
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  // Adds an eye toggle to a password field so the operator can verify what they
  // typed (only reveals the value in the input — stored secrets are never echoed).
  revealable?: boolean;
  revealLabels?: { show: string; hide: string };
  type?: 'text' | 'password' | 'number';
  value: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const showToggle = revealable && type === 'password' && !disabled;
  const effectiveType = showToggle && revealed ? 'text' : type;

  return (
    <label className="grid gap-1.5">
      <span className="text-[13px] font-bold text-afro-muted">{label}</span>
      <div className="relative">
        <input
          autoComplete={autoComplete}
          className={`min-h-10 w-full rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45 ${
            showToggle ? 'pr-11' : ''
          }`}
          disabled={disabled}
          dir="ltr"
          inputMode={inputMode}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          type={effectiveType}
          value={value}
        />
        {showToggle ? (
          <button
            type="button"
            aria-label={revealed ? revealLabels?.hide : revealLabels?.show}
            aria-pressed={revealed}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-afro-muted hover:text-afro-ink"
            onClick={() => setRevealed((current) => !current)}
            tabIndex={-1}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
    </label>
  );
}

export function SettingsSelect({
  disabled = false,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[13px] font-bold text-afro-muted">{label}</span>
      <select
        className="min-h-10 w-full rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value || 'empty'} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
