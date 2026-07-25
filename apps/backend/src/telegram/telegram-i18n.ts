/**
 * Bilingual (Persian + English) copy map for the afroWS self-service bot.
 *
 * SOURCE OF TRUTH: docs/telegram-bot-flow-design.md §4 (bilingual copy table) and
 * §6.2 (complete string-id set). The 56 ids below match that table exactly; the
 * EN/FA wording is transcribed verbatim (HTML tags, ZWNJ, Persian digits in prose,
 * ASCII-only copyable payloads). Do not invent user-facing strings outside this
 * map — a missing translation is a compile error (typed Record<CopyId, {en,fa}>).
 *
 * HTML: messages are sent with parse_mode 'HTML'; <b>/<code> are part of the copy.
 * Interpolated values are HTML-escaped by renderTelegramCopy (raw sub-copy such as
 * {status}/{quotaLine} is passed via the `raw` channel).
 */

export type TelegramLanguage = 'en' | 'fa';

/** Escape HTML-significant characters before interpolating into an HTML message. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const TELEGRAM_LANGUAGES: readonly TelegramLanguage[] = ['en', 'fa'];

export function isTelegramLanguage(value: unknown): value is TelegramLanguage {
  return value === 'en' || value === 'fa';
}

export function normalizeTelegramLanguage(value: unknown, fallback: TelegramLanguage = 'fa'): TelegramLanguage {
  return isTelegramLanguage(value) ? value : fallback;
}

/** The complete set of copy string-ids (docs §6.2) — 56 keys. */
export type TelegramCopyId =
  | 'lang.prompt'
  | 'lang.btn.fa'
  | 'lang.btn.en'
  | 'lang.settings'
  | 'lang.updated'
  | 'lang.toast'
  | 'welcome.new'
  | 'welcome.newNoConfig'
  | 'welcome.back'
  | 'menu.title'
  | 'menu.btn.account'
  | 'menu.btn.buy'
  | 'menu.btn.configs'
  | 'menu.btn.lang'
  | 'menu.btn.help'
  | 'acct.card'
  | 'acct.quotaLine'
  | 'acct.quotaUnlimited'
  | 'acct.expiryLine'
  | 'status.active'
  | 'status.suspended'
  | 'status.expired'
  | 'status.disabled'
  | 'cfg.title'
  | 'cfg.itemHeader'
  | 'cfg.importHint'
  | 'cfg.truncated'
  | 'cfg.empty'
  | 'cfg.btn.open'
  | 'buy.btn.open'
  | 'buy.pickPackage'
  | 'buy.pkgBtn'
  | 'buy.pendingApprovalNote'
  | 'buy.resumeNote'
  | 'buy.payment'
  | 'buy.needPhoto'
  | 'buy.submitted'
  | 'buy.cancelled'
  | 'buy.btn.cancel'
  | 'buy.btn.retry'
  | 'buy.toast.cancelled'
  | 'notify.approved'
  | 'notify.rejected'
  | 'notify.noReason'
  | 'help.body'
  | 'common.btn.menu'
  | 'common.btn.refresh'
  | 'common.btn.retry'
  | 'common.toast.refreshed'
  | 'error.noPackages'
  | 'error.cardUnset'
  | 'error.photoNoCharge'
  | 'error.accountProblem'
  | 'error.generic'
  | 'error.unknownCommand'
  | 'error.staleButton';

type CopyEntry = { en: string; fa: string };

/** The full bilingual copy table (docs §4). `\n` = line break; {tokens} interpolated. */
export const TELEGRAM_COPY: Record<TelegramCopyId, CopyEntry> = {
  'lang.prompt': {
    en: 'Hi! 👋 Welcome to <b>afroWS</b>.\nPlease choose your language:\n\nسلام! 👋 به <b>afroWS</b> خوش آمدید.\nلطفاً زبان خود را انتخاب کنید:',
    fa: 'Hi! 👋 Welcome to <b>afroWS</b>.\nPlease choose your language:\n\nسلام! 👋 به <b>afroWS</b> خوش آمدید.\nلطفاً زبان خود را انتخاب کنید:',
  },
  'lang.btn.fa': { en: 'فارسی 🇮🇷', fa: 'فارسی 🇮🇷' },
  'lang.btn.en': { en: 'English 🇬🇧', fa: 'English 🇬🇧' },
  'lang.settings': {
    en: '🌐 Language\nYour current language is <b>English</b>. Pick a language:',
    fa: '🌐 زبان\nزبان فعلی شما <b>فارسی</b> است. زبان مورد نظر را انتخاب کنید:',
  },
  'lang.updated': {
    en: 'Language set to English. ✅',
    fa: 'زبان به فارسی تغییر کرد. ✅',
  },
  'lang.toast': { en: 'Language updated ✅', fa: 'زبان تغییر کرد ✅' },
  'welcome.new': {
    en: "🎉 You're in!\nYour afroWS account is ready, with a free <b>{trialQuota}</b> trial already loaded.\n\nHere's your VLESS config — tap it once to copy:\n<code>{configLink}</code>\n\nImport it into your VPN app (e.g. v2rayNG or Streisand) and connect.\nWhen you need more data, tap <b>Buy Data</b> below.",
    fa: '🎉 خوش آمدید!\nحساب afroWS شما ساخته شد و <b>{trialQuota}</b> حجم هدیه هم برایتان فعال است.\n\nاین کانفیگ VLESS شماست — یک بار رویش بزنید تا کپی شود:\n<code>{configLink}</code>\n\nآن را در اپ VPN خود (مثل v2rayNG یا Streisand) وارد کنید و وصل شوید.\nهر وقت حجم بیشتری خواستید، از دکمهٔ «خرید حجم» استفاده کنید.',
  },
  'welcome.newNoConfig': {
    en: "🎉 You're in! Your afroWS account is ready with a free <b>{trialQuota}</b> trial.\nYour config is being prepared — tap <b>My Configs</b> in a moment to grab it.",
    fa: '🎉 خوش آمدید! حساب afroWS شما با <b>{trialQuota}</b> حجم هدیه ساخته شد.\nکانفیگ شما در حال آماده‌سازی است — کمی بعد از «کانفیگ‌های من» آن را بردارید.',
  },
  'welcome.back': {
    en: 'Welcome back! 👋 What would you like to do?',
    fa: 'خوش برگشتید! 👋 چه کاری برایتان انجام دهیم؟',
  },
  'menu.title': {
    en: '🏠 Main menu — pick an option:',
    fa: '🏠 منوی اصلی — یک گزینه را انتخاب کنید:',
  },
  'menu.btn.account': { en: '👤 My Account', fa: '👤 حساب من' },
  'menu.btn.buy': { en: '🛒 Buy Data', fa: '🛒 خرید حجم' },
  'menu.btn.configs': { en: '🔗 My Configs', fa: '🔗 کانفیگ‌های من' },
  'menu.btn.lang': { en: '🌐 Language', fa: '🌐 زبان' },
  'menu.btn.help': { en: '❓ Help', fa: '❓ راهنما' },
  'acct.card': {
    en: '👤 <b>Your account</b>\nStatus: {status}\n{quotaLine}\nUsed: {used}\nActive configs: {activeClients}/{clientCount}',
    fa: '👤 <b>حساب شما</b>\nوضعیت: {status}\n{quotaLine}\nمصرف‌شده: {used}\nکانفیگ‌های فعال: {activeClients} از {clientCount}',
  },
  'acct.quotaLine': {
    en: 'Data left: <b>{remaining}</b> of {total}',
    fa: 'حجم باقی‌مانده: <b>{remaining}</b> از {total}',
  },
  'acct.quotaUnlimited': { en: 'Data: Unlimited', fa: 'حجم: نامحدود' },
  'acct.expiryLine': { en: 'Expires: {expiresAt}', fa: 'تاریخ انقضا: {expiresAt}' },
  'status.active': { en: 'Active ✅', fa: 'فعال ✅' },
  'status.suspended': { en: 'Suspended ⏸', fa: 'معلق ⏸' },
  'status.expired': { en: 'Expired ⌛', fa: 'منقضی ⌛' },
  'status.disabled': { en: 'Disabled 🚫', fa: 'غیرفعال 🚫' },
  'cfg.title': {
    en: '🔗 <b>Your configs</b>\nTap any config once to copy it:',
    fa: '🔗 <b>کانفیگ‌های شما</b>\nروی هر کانفیگ یک بار بزنید تا کپی شود:',
  },
  'cfg.itemHeader': { en: '• {protocol} — {label}', fa: '• {protocol} — {label}' },
  'cfg.importHint': {
    en: 'Import the copied link into your VPN app (e.g. v2rayNG) and connect.',
    fa: 'لینک کپی‌شده را در اپ VPN خود (مثل v2rayNG) وارد کنید و وصل شوید.',
  },
  'cfg.truncated': {
    en: '…and more. Contact support to see the rest.',
    fa: '…و موارد دیگر. برای دیدن بقیه با پشتیبانی در تماس باشید.',
  },
  'cfg.empty': {
    en: "You don't have any configs yet. 🙈\nBuy a data package and we'll set one up for you right away.",
    fa: 'هنوز کانفیگی ندارید. 🙈\nیک بستهٔ حجمی بخرید تا بلافاصله برایتان بسازیم.',
  },
  'cfg.btn.open': { en: '🔗 My Configs', fa: '🔗 کانفیگ‌های من' },
  'buy.btn.open': { en: '🛒 Buy Data', fa: '🛒 خرید حجم' },
  'buy.pickPackage': {
    en: "🛒 <b>Buy Data</b>\nPick a package — you'll get the payment details next:",
    fa: '🛒 <b>خرید حجم</b>\nیک بسته را انتخاب کنید — در مرحلهٔ بعد اطلاعات پرداخت را می‌بینید:',
  },
  'buy.pkgBtn': { en: '{size} — {price}', fa: '{size} — {price}' },
  'buy.pendingApprovalNote': {
    en: 'ℹ️ Your previous request #{requestId} is still awaiting approval.',
    fa: 'ℹ️ درخواست قبلی شما (شمارهٔ {requestId}) هنوز در انتظار تأیید است.',
  },
  'buy.resumeNote': {
    en: 'ℹ️ You have an unfinished purchase — here are the payment details again:',
    fa: 'ℹ️ یک خرید نیمه‌تمام دارید — این هم دوبارهٔ اطلاعات پرداخت:',
  },
  'buy.payment': {
    en: '🧾 <b>Order:</b> {packageSize} — <b>{amount}</b>\n\nPlease transfer card-to-card to:\n💳 <code>{cardNumber}</code>\nName: <b>{cardHolder}</b>\n\nThen send a <b>photo of the receipt</b> right here. 📸\nOnce an admin approves it, the data is added to your account.',
    fa: '🧾 <b>سفارش:</b> {packageSize} — <b>{amount}</b>\n\nلطفاً مبلغ را کارت‌به‌کارت واریز کنید:\n💳 <code>{cardNumber}</code>\nبه نام: <b>{cardHolder}</b>\n\nسپس <b>عکس رسید</b> را همین‌جا بفرستید. 📸\nبعد از تأیید مدیر، حجم به حساب شما اضافه می‌شود.',
  },
  'buy.needPhoto': {
    en: 'Please send the receipt as a <b>photo</b> (not a file), so we can review it. 📸',
    fa: 'لطفاً رسید را به‌صورت <b>عکس</b> بفرستید (نه فایل) تا بتوانیم بررسی‌اش کنیم. 📸',
  },
  'buy.submitted': {
    en: "✅ Got your receipt!\nRequest <b>#{requestId}</b> is submitted and awaiting admin approval.\nWe'll message you here as soon as it's reviewed.",
    fa: '✅ رسید شما رسید!\nدرخواست <b>شمارهٔ {requestId}</b> ثبت شد و در انتظار تأیید مدیر است.\nبه‌محض بررسی، همین‌جا به شما خبر می‌دهیم.',
  },
  'buy.cancelled': {
    en: 'Purchase cancelled. No worries — come back any time. 🙂',
    fa: 'خرید لغو شد. اشکالی ندارد — هر وقت خواستید دوباره سر بزنید. 🙂',
  },
  'buy.btn.cancel': { en: '❌ Cancel purchase', fa: '❌ انصراف از خرید' },
  'buy.btn.retry': { en: '🛒 Try again', fa: '🛒 تلاش دوباره' },
  'buy.toast.cancelled': { en: 'Purchase cancelled', fa: 'خرید لغو شد' },
  'notify.approved': {
    en: '✅ Request <b>#{requestId}</b> approved — <b>{packageSize}</b> has been added to your account. Enjoy! 🎉',
    fa: '✅ درخواست <b>شمارهٔ {requestId}</b> تأیید شد و <b>{packageSize}</b> به حساب شما اضافه شد. نوش جان! 🎉',
  },
  'notify.rejected': {
    en: '❌ Request <b>#{requestId}</b> was not approved.\nReason: {reason}\nIf you think this is a mistake, try again or contact support.',
    fa: '❌ درخواست <b>شمارهٔ {requestId}</b> تأیید نشد.\nدلیل: {reason}\nاگر فکر می‌کنید اشتباهی پیش آمده، دوباره تلاش کنید یا با پشتیبانی در تماس باشید.',
  },
  'notify.noReason': { en: 'Not specified', fa: 'ذکر نشده' },
  'help.body': {
    en: '❓ <b>How afroWS works</b>\n• <b>My Account</b> — your status and remaining data.\n• <b>Buy Data</b> — pick a package, pay card-to-card, send the receipt photo; an admin approves it and your data is added.\n• <b>My Configs</b> — your connection links, tap to copy.\n\nSupport: {supportContact}',
    fa: '❓ <b>afroWS چطور کار می‌کند؟</b>\n• <b>حساب من</b> — وضعیت و حجم باقی‌ماندهٔ شما.\n• <b>خرید حجم</b> — یک بسته انتخاب کنید، کارت‌به‌کارت پرداخت کنید و عکس رسید را بفرستید؛ بعد از تأیید مدیر، حجم اضافه می‌شود.\n• <b>کانفیگ‌های من</b> — لینک‌های اتصال شما؛ با یک لمس کپی می‌شوند.\n\nپشتیبانی: {supportContact}',
  },
  'common.btn.menu': { en: '🏠 Main menu', fa: '🏠 منوی اصلی' },
  'common.btn.refresh': { en: '🔄 Refresh', fa: '🔄 به‌روزرسانی' },
  'common.btn.retry': { en: '🔁 Try again', fa: '🔁 تلاش دوباره' },
  'common.toast.refreshed': { en: 'Updated ✅', fa: 'به‌روز شد ✅' },
  'error.noPackages': {
    en: 'No data packages are available right now. 🙏\nPlease check back a little later.',
    fa: 'فعلاً بسته‌ای برای فروش موجود نیست. 🙏\nلطفاً کمی بعد دوباره سر بزنید.',
  },
  'error.cardUnset': {
    en: "Payments aren't set up yet. 🙏\nPlease try again later — we're on it.",
    fa: 'پرداخت هنوز راه‌اندازی نشده است. 🙏\nلطفاً کمی بعد دوباره تلاش کنید — در حال آماده‌سازی هستیم.',
  },
  'error.photoNoCharge': {
    en: "Thanks for the photo — but there's no purchase in progress. 🤔\nStart one with <b>Buy Data</b>, then send the receipt.",
    fa: 'ممنون از عکس — ولی خرید فعالی در جریان نیست. 🤔\nاول از «خرید حجم» شروع کنید، بعد رسید را بفرستید.',
  },
  'error.accountProblem': {
    en: "There's a problem with your account link. 😕\nPlease contact support so we can fix it for you.",
    fa: 'مشکلی در اتصال حساب شما وجود دارد. 😕\nلطفاً با پشتیبانی در تماس باشید تا برایتان درستش کنیم.',
  },
  'error.generic': {
    en: 'Something went wrong on our side. 😕\nPlease try again.',
    fa: 'مشکلی از سمت ما پیش آمد. 😕\nلطفاً دوباره تلاش کنید.',
  },
  'error.unknownCommand': {
    en: "I didn't recognize that command — here's what I can do:",
    fa: 'این دستور را نشناختم — این کارها از من برمی‌آید:',
  },
  'error.staleButton': {
    en: 'This menu is outdated — sending a fresh one.',
    fa: 'این منو قدیمی شده — منوی تازه فرستادیم.',
  },
};

/**
 * Resolve a copy string by id + language. `vars` values are HTML-escaped (safe for
 * parse_mode HTML); `raw` values (already-rendered sub-copy such as {status} and
 * {quotaLine}) are substituted verbatim. Button labels pass values through `raw`
 * (plain-text context, no escaping needed).
 */
export function renderTelegramCopy(
  id: TelegramCopyId,
  language: TelegramLanguage,
  vars: Record<string, string | number> = {},
  raw: Record<string, string> = {},
): string {
  const template = TELEGRAM_COPY[id][language];
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (key in raw) return raw[key];
    if (key in vars) return escapeHtml(String(vars[key]));
    return match;
  });
}
