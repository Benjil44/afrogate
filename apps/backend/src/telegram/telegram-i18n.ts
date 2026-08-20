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

/** The complete set of copy string-ids (docs §6.2 + §14.3 v2 additions). */
export type TelegramCopyId =
  | 'lang.prompt'
  | 'lang.btn.fa'
  | 'lang.btn.en'
  | 'lang.settings'
  | 'lang.updated'
  | 'lang.toast'
  | 'welcome.registered'
  | 'welcome.registeredNoConfig'
  | 'welcome.back'
  | 'menu.title'
  | 'menu.btn.account'
  | 'menu.btn.buy'
  | 'menu.btn.configs'
  | 'menu.btn.invite'
  | 'menu.btn.gems'
  | 'menu.btn.connect'
  | 'menu.btn.lang'
  | 'menu.btn.help'
  | 'acct.cardV2'
  | 'acct.gemsLine'
  | 'acct.expiryLine'
  | 'usage.line'
  | 'usage.zeroData'
  | 'usage.unlimited'
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
  | 'common.btn.back'
  | 'common.toast.refreshed'
  | 'error.noPackages'
  | 'error.cardUnset'
  | 'error.photoNoCharge'
  | 'error.accountProblem'
  | 'error.generic'
  | 'error.unknownCommand'
  | 'error.staleButton'
  // --- v2 registration (docs §12 reg.*) ---
  | 'reg.askName'
  | 'reg.viaInvite'
  | 'reg.nameInvalid'
  | 'reg.askPhone'
  | 'reg.btn.sharePhone'
  | 'reg.phoneNeedButton'
  | 'reg.phoneNotYours'
  | 'reg.phoneOk'
  | 'reg.linkedExisting'
  | 'reg.finishFirst'
  // --- Connect / sync my account (docs §15 connect.*) ---
  | 'connect.intro'
  | 'connect.merged'
  | 'connect.alreadySynced'
  | 'connect.ownedByOther'
  | 'connect.ambiguous'
  | 'connect.noMatch'
  // --- v2 Invite & Earn (docs §12 invite.*) ---
  | 'invite.card'
  | 'invite.btn.share'
  | 'invite.shareText'
  // --- v2 Gems wallet + redeem (docs §12 gems.*) ---
  | 'gems.card'
  | 'gems.historyTitle'
  | 'gems.historyItem'
  | 'gems.historyEmpty'
  | 'gems.reason.signup'
  | 'gems.reason.commission'
  | 'gems.reason.milestone'
  | 'gems.reason.redeem'
  | 'gems.reason.adjust'
  | 'gems.btn.redeem'
  | 'gems.redeemPick'
  | 'gems.redeemBtn'
  | 'gems.redeemBtnMax'
  | 'gems.redeemConfirm'
  | 'gems.btn.confirm'
  | 'gems.redeemed'
  | 'gems.redeemTooFew'
  | 'gems.toast.insufficient'
  // --- v2 referral notifications (docs §12 notify.ref*) ---
  | 'notify.refJoined'
  | 'notify.refPurchase'
  | 'notify.refMilestone';

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
  'welcome.registered': {
    en: '🎉 <b>Welcome, {name}!</b>\nYour afroWS account is ready, and your config <b>{configLabel}</b> is set up — tap it once to copy:\n<code>{configLink}</code>\n\nYour balance is <b>0 GB</b> for now — the config comes alive the moment you add data:\n🛒 <b>Buy Data</b> — packages start small.\n🎁 <b>Invite & Earn</b> — friends join, you earn gems, gems become GB.',
    fa: '🎉 <b>خوش آمدید، {name}!</b>\nحساب afroWS شما آماده است و کانفیگ <b>{configLabel}</b> هم برایتان ساخته شد — یک بار رویش بزنید تا کپی شود:\n<code>{configLink}</code>\n\nموجودی شما فعلاً <b>۰ گیگابایت</b> است — به‌محض اضافه‌کردن حجم، کانفیگ فعال می‌شود:\n🛒 <b>خرید حجم</b> — بسته‌ها از حجم کم شروع می‌شوند.\n🎁 <b>دعوت و هدیه</b> — دوستانتان بیایند، شما جم می‌گیرید و جم‌ها گیگابایت می‌شوند.',
  },
  'welcome.registeredNoConfig': {
    en: '🎉 <b>Welcome, {name}!</b> Your afroWS account is ready.\nYour config is being prepared — tap <b>My Configs</b> in a moment to grab it.\nYour balance is <b>0 GB</b> for now — add data with <b>Buy Data</b> or earn it via <b>Invite & Earn</b>.',
    fa: '🎉 <b>خوش آمدید، {name}!</b> حساب afroWS شما آماده است.\nکانفیگ شما در حال آماده‌سازی است — کمی بعد از «کانفیگ‌های من» آن را بردارید.\nموجودی شما فعلاً <b>۰ گیگابایت</b> است — با «خرید حجم» حجم بگیرید یا با «دعوت و هدیه» جم جمع کنید.',
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
  'menu.btn.invite': { en: '🎁 Invite & Earn', fa: '🎁 دعوت و هدیه' },
  'menu.btn.gems': { en: '💎 Gems', fa: '💎 جم‌ها' },
  'menu.btn.connect': { en: '🔁 Connect my account', fa: '🔁 اتصال حساب من' },
  'menu.btn.lang': { en: '🌐 Language', fa: '🌐 زبان' },
  'menu.btn.help': { en: '❓ Help', fa: '❓ راهنما' },
  'acct.cardV2': {
    en: '👤 <b>{name}</b>\nStatus: {status}\n\n{usageBlock}\n\n{gemsLine}\n🔗 Active configs: {activeClients}/{clientCount}',
    fa: '👤 <b>{name}</b>\nوضعیت: {status}\n\n{usageBlock}\n\n{gemsLine}\n🔗 کانفیگ‌های فعال: {activeClients} از {clientCount}',
  },
  'acct.gemsLine': {
    en: '💎 Gems: <b>{gems}</b> (≈ {gemsGb} GB)',
    fa: '💎 جم: <b>{gems}</b> (حدود {gemsGb} گیگابایت)',
  },
  'acct.expiryLine': { en: 'Expires: {expiresAt}', fa: 'تاریخ انقضا: {expiresAt}' },
  'usage.line': {
    en: '📊 <code>{bar}</code> <b>{percent}%</b> used\n{used} of {total} — <b>{remaining}</b> left',
    fa: '📊 <code>{bar}</code> <b>{percent}٪</b> مصرف شده\n{used} از {total} — <b>{remaining}</b> باقی‌مانده',
  },
  'usage.zeroData': {
    en: '📊 You have <b>0 GB</b> right now.\nBuy a package or invite friends to get connected.',
    fa: '📊 موجودی شما فعلاً <b>۰ گیگابایت</b> است.\nبرای اتصال، یک بسته بخرید یا دوستانتان را دعوت کنید.',
  },
  'usage.unlimited': {
    en: '📊 Data: Unlimited — used so far: {used}',
    fa: '📊 حجم: نامحدود — مصرف تاکنون: {used}',
  },
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
    en: '❓ <b>How afroWS works</b>\n• <b>My Account</b> — your status and remaining data.\n• <b>Buy Data</b> — pick a package, pay card-to-card, send the receipt photo; an admin approves it and your data is added.\n• <b>My Configs</b> — your connection links, tap to copy.\n• <b>Connect my account</b> — already have an account we set up for you? Share your phone to merge this bot account into it.\n\nSupport: {supportContact}',
    fa: '❓ <b>afroWS چطور کار می‌کند؟</b>\n• <b>حساب من</b> — وضعیت و حجم باقی‌ماندهٔ شما.\n• <b>خرید حجم</b> — یک بسته انتخاب کنید، کارت‌به‌کارت پرداخت کنید و عکس رسید را بفرستید؛ بعد از تأیید مدیر، حجم اضافه می‌شود.\n• <b>کانفیگ‌های من</b> — لینک‌های اتصال شما؛ با یک لمس کپی می‌شوند.\n• <b>اتصال حساب من</b> — قبلاً برایتان حسابی ساخته‌ایم؟ شماره‌تان را به اشتراک بگذارید تا این حساب ربات در آن ادغام شود.\n\nپشتیبانی: {supportContact}',
  },
  'common.btn.menu': { en: '🏠 Main menu', fa: '🏠 منوی اصلی' },
  'common.btn.refresh': { en: '🔄 Refresh', fa: '🔄 به‌روزرسانی' },
  'common.btn.retry': { en: '🔁 Try again', fa: '🔁 تلاش دوباره' },
  'common.btn.back': { en: '◀️ Back', fa: '◀️ بازگشت' },
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

  // === v2 (docs §12) — registration ===
  'reg.askName': {
    en: '📝 <b>Step 1/2 — your name</b>\nWhat should we call you? Type your name below.\nIt also names your config, so keep it short and sweet.',
    fa: '📝 <b>مرحلهٔ ۱ از ۲ — نام شما</b>\nشما را چه صدا کنیم؟ نامتان را همین‌جا بنویسید.\nنام کانفیگ شما هم از روی آن ساخته می‌شود، پس کوتاه و خودمانی بنویسید.',
  },
  'reg.viaInvite': {
    en: "🎁 You're here on a friend's invite — once you sign up, they get a thank-you bonus!",
    fa: '🎁 شما با دعوت یکی از دوستانتان آمده‌اید — بعد از ثبت‌نام، هدیهٔ تشکر به دوستتان می‌رسد!',
  },
  'reg.nameInvalid': {
    en: "Hmm, that doesn't look like a name — please send 2 to 40 characters of plain text. 🙏",
    fa: 'این مورد شبیه نام نیست — لطفاً بین ۲ تا ۴۰ حرف، فقط متن ساده بفرستید. 🙏',
  },
  'reg.askPhone': {
    en: '📱 <b>Step 2/2 — your phone number</b>\nTap the button below to share your number — one tap, no typing.\nWe use it to name your config and keep your account recoverable.',
    fa: '📱 <b>مرحلهٔ ۲ از ۲ — شمارهٔ موبایل</b>\nروی دکمهٔ پایین بزنید تا شماره‌تان ثبت شود — فقط یک لمس، بدون تایپ.\nاز شماره برای نام‌گذاری کانفیگ و بازیابی حسابتان استفاده می‌کنیم.',
  },
  'reg.btn.sharePhone': { en: '📱 Share my phone number', fa: '📱 اشتراک شمارهٔ من' },
  'reg.phoneNeedButton': {
    en: "Please use the <b>Share my phone number</b> button below — a typed number can't be verified. 🙏",
    fa: 'لطفاً از دکمهٔ <b>اشتراک شمارهٔ من</b> در پایین استفاده کنید — شمارهٔ تایپ‌شده قابل تأیید نیست. 🙏',
  },
  'reg.phoneNotYours': {
    en: "That contact isn't your own Telegram number — please tap the share button so we get yours. 🙏",
    fa: 'این مخاطب، شمارهٔ تلگرام خود شما نیست — لطفاً روی دکمهٔ اشتراک بزنید تا شمارهٔ خودتان ثبت شود. 🙏',
  },
  'reg.phoneOk': {
    en: 'Thanks, {name}! Setting up your account… ✅',
    fa: 'ممنون، {name}! در حال آماده‌سازی حساب شما… ✅',
  },
  'reg.linkedExisting': {
    en: '✅ <b>Welcome back, {name}!</b>\nWe found your existing afroWS account and linked this Telegram to it — no new account was created. Here is where things stand:',
    fa: '✅ <b>خوش برگشتید، {name}!</b>\nحساب afroWS قبلی شما را پیدا کردیم و همین تلگرام را به آن وصل کردیم — حساب جدیدی ساخته نشد. وضعیت حساب شما:',
  },
  'reg.finishFirst': { en: 'Please finish signup first 🙏', fa: 'لطفاً اول ثبت‌نام را تمام کنید 🙏' },

  // === Connect / sync my account (docs §15) ===
  'connect.intro': {
    en: '🔁 <b>Connect / sync my account</b>\nAlready have an afroWS account we set up for you? Share your phone number and, if it matches, we\'ll move your current data, gems and configs onto that account.\nTap the button below to share your number — one tap, no typing.',
    fa: '🔁 <b>اتصال / همگام‌سازی حساب من</b>\nقبلاً برایتان یک حساب afroWS ساخته‌ایم؟ شماره‌تان را به اشتراک بگذارید؛ اگر مطابقت داشت، حجم، جم‌ها و کانفیگ‌های فعلی‌تان را به همان حساب منتقل می‌کنیم.\nبرای اشتراک شماره روی دکمهٔ پایین بزنید — فقط یک لمس، بدون تایپ.',
  },
  'connect.merged': {
    en: '✅ <b>All synced, {name}!</b>\nWe found your existing account and moved your data, gems and configs onto it — your bot account was merged in. Here is where things stand:',
    fa: '✅ <b>همه‌چیز همگام شد، {name}!</b>\nحساب قبلی شما را پیدا کردیم و حجم، جم‌ها و کانفیگ‌هایتان را به آن منتقل کردیم — حساب رباتتان در آن ادغام شد. وضعیت حساب شما:',
  },
  'connect.alreadySynced': {
    en: "✅ You're already on this account — nothing to merge. Your details are saved and up to date. 👍",
    fa: '✅ شما همین حالا روی همین حساب هستید — چیزی برای ادغام نیست. اطلاعاتتان ذخیره و به‌روز است. 👍',
  },
  'connect.ownedByOther': {
    en: "🔒 This phone number is already linked to another afroWS account. For your security we won't merge it automatically.\nPlease contact support and we'll sort it out for you.",
    fa: '🔒 این شماره از قبل به حساب دیگری در afroWS متصل است. برای امنیت شما، آن را به‌صورت خودکار ادغام نمی‌کنیم.\nلطفاً با پشتیبانی در تماس باشید تا برایتان بررسی کنیم.',
  },
  'connect.ambiguous': {
    en: "🤔 We found more than one account with this phone number, so we can't merge automatically.\nPlease contact support and we'll connect the right one for you.",
    fa: '🤔 بیش از یک حساب با این شماره پیدا کردیم، بنابراین نمی‌توانیم به‌صورت خودکار ادغام کنیم.\nلطفاً با پشتیبانی در تماس باشید تا حساب درست را برایتان وصل کنیم.',
  },
  'connect.noMatch': {
    en: "📇 Thanks — we saved your number to this account.\nWe didn't find another account to merge, so you're all set here. Add data with <b>Buy Data</b> or earn it via <b>Invite & Earn</b>.",
    fa: '📇 ممنون — شماره‌تان را روی همین حساب ذخیره کردیم.\nحساب دیگری برای ادغام پیدا نکردیم، پس همین حساب فعال است. با «خرید حجم» حجم بگیرید یا با «دعوت و هدیه» جم جمع کنید.',
  },

  // === v2 — Invite & Earn ===
  'invite.card': {
    en: '🎁 <b>Invite & Earn</b>\nIntroduce afroWS to your friends and earn gems:\n• <b>+{signupBonus} gems</b> for every friend who joins\n• <b>{pct}%</b> of every purchase they make, paid in gems\n• <b>+{milestoneBonus} gems</b> bonus for every {milestoneCount} friends\n\nYour invite code: <code>{inviteCode}</code>\nYour link — tap once to copy:\n<code>{inviteLink}</code>\n\n👥 Friends joined: <b>{referralCount}</b>\n💎 Gems earned from invites: <b>{gemsEarned}</b>',
    fa: '🎁 <b>دعوت و هدیه</b>\nafroWS را به دوستانتان معرفی کنید و جم بگیرید:\n• <b>{signupBonus} جم</b> برای هر دوستی که عضو شود\n• <b>{pct}٪</b> از هر خریدش، به‌صورت جم\n• <b>{milestoneBonus} جم</b> جایزه برای هر {milestoneCount} دوست\n\nکد دعوت شما: <code>{inviteCode}</code>\nلینک شما — یک بار بزنید تا کپی شود:\n<code>{inviteLink}</code>\n\n👥 دوستان عضوشده: <b>{referralCount}</b>\n💎 جم به‌دست‌آمده از دعوت‌ها: <b>{gemsEarned}</b>',
  },
  'invite.btn.share': { en: '📤 Share with friends', fa: '📤 فرستادن برای دوستان' },
  'invite.shareText': {
    en: 'I use afroWS for fast, reliable internet — join with my link and we both win 🎁',
    fa: 'من از afroWS برای اینترنت پرسرعت و مطمئن استفاده می‌کنم — با لینک من بیا تا هر دو هدیه بگیریم 🎁',
  },

  // === v2 — Gems wallet & redeem ===
  'gems.card': {
    en: '💎 <b>Your gems</b>\nBalance: <b>{gems}</b> gems (≈ <b>{gemsGb}</b> GB)\nRate: {rateGems} gems = 1 GB\n\n{history}',
    fa: '💎 <b>جم‌های شما</b>\nموجودی: <b>{gems}</b> جم (حدود <b>{gemsGb}</b> گیگابایت)\nنرخ تبدیل: هر {rateGems} جم = ۱ گیگابایت\n\n{history}',
  },
  'gems.historyTitle': { en: 'Recent activity:', fa: 'تراکنش‌های اخیر:' },
  'gems.historyItem': { en: '• {date} — {delta} · {reason}', fa: '• {date} — {delta} · {reason}' },
  'gems.historyEmpty': {
    en: 'No gems activity yet — invite friends to start earning! 🎁',
    fa: 'هنوز تراکنشی ندارید — با دعوت دوستان جم جمع کنید! 🎁',
  },
  'gems.reason.signup': { en: 'friend joined', fa: 'پیوستن دوست' },
  'gems.reason.commission': { en: "friend's purchase bonus", fa: 'پاداش خرید دوست' },
  'gems.reason.milestone': { en: 'milestone bonus', fa: 'پاداش ویژهٔ دعوت' },
  'gems.reason.redeem': { en: 'redeemed to data', fa: 'تبدیل به حجم' },
  'gems.reason.adjust': { en: 'support adjustment', fa: 'اصلاح توسط پشتیبانی' },
  'gems.btn.redeem': { en: '💱 Redeem gems → GB', fa: '💱 تبدیل جم به گیگ' },
  'gems.redeemPick': {
    en: '💱 <b>Redeem gems for data</b>\nBalance: <b>{gems}</b> gems · rate: {rateGems} gems = 1 GB\nPick how much data to add:',
    fa: '💱 <b>تبدیل جم به حجم</b>\nموجودی: <b>{gems}</b> جم · نرخ: هر {rateGems} جم = ۱ گیگابایت\nچقدر حجم اضافه کنیم؟',
  },
  'gems.redeemBtn': { en: '{gb} GB — {gems} gems', fa: '{gb} گیگابایت — {gems} جم' },
  'gems.redeemBtnMax': { en: 'Max: {gb} GB — {gems} gems', fa: 'حداکثر: {gb} گیگابایت — {gems} جم' },
  'gems.redeemConfirm': {
    en: "You're redeeming <b>{gems}</b> gems for <b>{gb} GB</b>.\nYou'll have {gemsAfter} gems left. Confirm?",
    fa: 'در حال تبدیل <b>{gems}</b> جم به <b>{gb} گیگابایت</b> هستید.\nبعد از آن {gemsAfter} جم برایتان می‌ماند. تأیید می‌کنید؟',
  },
  'gems.btn.confirm': { en: '✅ Confirm', fa: '✅ تأیید' },
  'gems.redeemed': {
    en: '✅ Done! <b>{gb} GB</b> added to your account.\n💎 Gems left: <b>{gemsAfter}</b>\n📊 Data balance now: <b>{remaining}</b>',
    fa: '✅ انجام شد! <b>{gb} گیگابایت</b> به حساب شما اضافه شد.\n💎 جم باقی‌مانده: <b>{gemsAfter}</b>\n📊 موجودی حجم: <b>{remaining}</b>',
  },
  'gems.redeemTooFew': {
    en: 'You need at least <b>{rateGems}</b> gems to redeem 1 GB — you have {gems}. 💎\nInvite friends to earn more!',
    fa: 'برای تبدیل به ۱ گیگابایت دست‌کم <b>{rateGems}</b> جم لازم است — شما {gems} جم دارید. 💎\nبا دعوت دوستان جم بیشتری جمع کنید!',
  },
  'gems.toast.insufficient': { en: 'Not enough gems', fa: 'جم کافی نیست' },

  // === v2 — referral notifications (pushed to the inviter) ===
  'notify.refJoined': {
    en: '🎉 <b>{friendName}</b> joined afroWS with your invite!\n💎 <b>{gems}</b> gems added — your balance: <b>{gemsBalance}</b>.',
    fa: '🎉 <b>{friendName}</b> با دعوت شما به afroWS پیوست!\n💎 <b>{gems}</b> جم به حسابتان اضافه شد — موجودی: <b>{gemsBalance}</b>.',
  },
  'notify.refPurchase': {
    en: '💎 <b>{friendName}</b> just bought <b>{packageSize}</b> — you earned <b>{gems}</b> gems ({pct}% commission).\nYour balance: <b>{gemsBalance}</b> gems.',
    fa: '💎 <b>{friendName}</b> همین حالا <b>{packageSize}</b> خرید — <b>{gems}</b> جم پاداش گرفتید ({pct}٪ کمیسیون).\nموجودی شما: <b>{gemsBalance}</b> جم.',
  },
  'notify.refMilestone': {
    en: '🏆 Amazing — <b>{count}</b> friends have joined with your invites!\nMilestone bonus: <b>{gems}</b> gems. Your balance: <b>{gemsBalance}</b>.',
    fa: '🏆 فوق‌العاده — <b>{count}</b> دوست با دعوت شما عضو شده‌اند!\nپاداش ویژه: <b>{gems}</b> جم. موجودی شما: <b>{gemsBalance}</b>.',
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
