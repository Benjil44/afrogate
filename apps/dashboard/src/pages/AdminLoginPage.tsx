import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LockKeyhole, LogIn, UserRound } from 'lucide-react';
import { type AdminSessionHook } from '../auth';
import { appVersion } from '../app-config';
import { LanguageButton } from '../components/Sidebar';
import type { DashboardFormatters } from '../formatters';
import type { DashboardLanguage, DashboardStrings } from '../i18n';

export function AdminLoginPage({
  auth,
  format,
  isRtl,
  language,
  nextLanguage,
  onLanguageChange,
  t,
}: {
  auth: AdminSessionHook;
  format: DashboardFormatters;
  isRtl: boolean;
  language: DashboardLanguage;
  nextLanguage: DashboardLanguage;
  onLanguageChange: (language: DashboardLanguage) => void;
  t: DashboardStrings;
}) {
  const [username, setUsername] = useState('superadmin');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isChecking = auth.status === 'checking';
  const errorMessage = auth.errorCode ? t.auth.errors[auth.errorCode] : null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void auth.signIn({ username, password });
  };

  return (
    <main
      className="grid min-h-screen place-items-center overflow-x-hidden bg-afro-page px-4 py-6 text-afro-ink"
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={language}
    >
      <section className="w-full max-w-[420px] rounded-md border border-afro-line bg-afro-panel p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-bold uppercase text-afro-teal">{t.auth.eyebrow}</p>
            <h1 className="text-[22px] leading-tight font-bold">{t.auth.title}</h1>
          </div>
          <LanguageButton nextLanguage={nextLanguage} onLanguageChange={onLanguageChange} t={t} variant="light" />
        </div>

        <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
          <label className="grid gap-1.5">
            <span className="text-[13px] font-bold text-afro-muted">{t.auth.username}</span>
            <span className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-afro-muted" size={16} />
              <input
                autoComplete="username"
                className="min-h-11 w-full rounded-md border border-afro-line bg-white px-10 text-sm font-bold outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4"
                dir="ltr"
                disabled={isChecking}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={t.auth.usernamePlaceholder}
                required
                type="text"
                value={username}
              />
            </span>
          </label>

          <label className="grid gap-1.5">
            <span className="text-[13px] font-bold text-afro-muted">{t.auth.password}</span>
            <span className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-afro-muted" size={16} />
              <input
                autoComplete="current-password"
                autoFocus
                className="min-h-11 w-full rounded-md border border-afro-line bg-white px-10 text-sm font-bold outline-none ring-afro-teal/20 focus:border-afro-teal focus:ring-4"
                dir="ltr"
                disabled={isChecking}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t.auth.passwordPlaceholder}
                required
                type={isPasswordVisible ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={isPasswordVisible ? t.auth.hidePassword : t.auth.showPassword}
                className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-afro-muted hover:bg-[#f4f7f8] hover:text-afro-ink disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isChecking}
                onClick={() => setIsPasswordVisible((current) => !current)}
                title={isPasswordVisible ? t.auth.hidePassword : t.auth.showPassword}
                type="button"
              >
                {isPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>

          {errorMessage ? (
            <div className="rounded-md border border-[#f0b7b7] bg-[#fff1f1] px-3 py-2 text-[13px] font-bold text-[#b91c1c]">
              {errorMessage}
            </div>
          ) : null}

          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-afro-sidebar px-4 text-sm font-bold text-white hover:bg-[#1f3138] disabled:cursor-wait disabled:opacity-70"
            disabled={isChecking}
            type="submit"
          >
            <LogIn size={17} />
            {isChecking ? t.auth.signingIn : t.auth.signIn}
          </button>
        </form>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-afro-line pt-3 text-[12px] text-afro-muted">
          <span>{isChecking ? t.auth.checking : t.auth.mfaReady}</span>
          <span className="font-bold text-afro-ink">v{appVersion}</span>
        </div>
      </section>
    </main>
  );
}
