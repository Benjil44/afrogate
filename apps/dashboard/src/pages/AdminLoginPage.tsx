import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LockKeyhole, LogIn, UserRound } from 'lucide-react';
import { type AdminSessionHook } from '../auth';
import { appVersion } from '../app-config';
import { LanguageButton } from '../components/Sidebar';
import type { DashboardFormatters } from '../formatters';
import type { DashboardLanguage, DashboardStrings } from '../i18n';

export function AdminLoginPage({
  auth,
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

  const inputClass =
    'afro-login-input min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-10 text-sm font-semibold text-white outline-none transition focus:border-[#7c5cff] focus:bg-white/[0.07] focus:ring-4 focus:ring-[#7c5cff]/20';

  return (
    <main
      className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-6 text-white"
      style={{ background: '#0a0a0f', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={language}
    >
      {/* Aurora glow */}
      <div
        aria-hidden
        className="afro-login-aurora pointer-events-none absolute left-1/2 top-1/2 h-[55vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 rounded-[50%] blur-[90px]"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(124,92,255,0.20) 0%, rgba(34,211,238,0.14) 42%, transparent 70%)',
        }}
      />
      {/* Grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundSize: '56px 56px',
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 72%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 72%)',
        }}
      />

      <section
        className="afro-login-card relative w-full max-w-[420px] rounded-2xl border border-white/10 p-7 backdrop-blur-xl"
        style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
          boxShadow: '0 30px 70px -25px rgba(0,0,0,0.7), inset 0 1px 1px rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <a href="https://afrows.com" className="mb-4 inline-flex items-center gap-2 text-lg font-black tracking-tight">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#0a0a0f] font-black">
                <span style={{ background: 'linear-gradient(135deg,#7c5cff,#22d3ee)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>A</span>
              </span>
              <span style={{ background: 'linear-gradient(180deg,#ffffff,rgba(255,255,255,0.55))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Afrows</span>
            </a>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: '#22d3ee' }}>
              {t.auth.eyebrow}
            </p>
            <h1 className="text-[22px] font-bold leading-tight">{t.auth.title}</h1>
          </div>
          <LanguageButton nextLanguage={nextLanguage} onLanguageChange={onLanguageChange} t={t} variant="dark" />
        </div>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-1.5">
            <span className="text-[13px] font-bold text-white/60">{t.auth.username}</span>
            <span className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
              <input
                autoComplete="username"
                className={inputClass}
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
            <span className="text-[13px] font-bold text-white/60">{t.auth.password}</span>
            <span className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
              <input
                autoComplete="current-password"
                autoFocus
                className={inputClass}
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
                className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
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
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] font-bold text-red-300">
              {errorMessage}
            </div>
          ) : null}

          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
            style={{ background: 'linear-gradient(135deg,#7c5cff,#22d3ee)', boxShadow: '0 12px 30px -8px rgba(124,92,255,0.5)' }}
            disabled={isChecking}
            type="submit"
          >
            <LogIn size={17} />
            {isChecking ? t.auth.signingIn : t.auth.signIn}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-white/10 pt-4 text-[12px] text-white/50">
          <span>{isChecking ? t.auth.checking : t.auth.mfaReady}</span>
          <span className="font-bold text-white/80">v{appVersion}</span>
        </div>
      </section>
    </main>
  );
}
