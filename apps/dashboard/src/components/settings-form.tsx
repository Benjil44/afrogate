export function SettingsInput({
  autoComplete,
  disabled = false,
  inputMode,
  label,
  onChange,
  placeholder,
  required = false,
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
  type?: 'text' | 'password' | 'number';
  value: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[13px] font-bold text-afro-muted">{label}</span>
      <input
        autoComplete={autoComplete}
        className="min-h-10 w-full rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4 disabled:opacity-45"
        disabled={disabled}
        dir="ltr"
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

export function SettingsSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[13px] font-bold text-afro-muted">{label}</span>
      <select
        className="min-h-10 w-full rounded-md border border-afro-line bg-white px-3 text-sm font-bold text-afro-ink outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4"
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
