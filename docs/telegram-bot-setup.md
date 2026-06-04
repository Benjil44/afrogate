# Telegram Bot Setup

Telegram bot creation happens inside Telegram with BotFather. Afrows does not create bots itself and should never store a plaintext bot token outside encrypted secret storage or deployment secrets.

## Superadmin Setup

1. Create the bot in Telegram through BotFather and copy the bot token once.
2. Open Dashboard > Settings > Telegram Bot Setup.
3. Paste the BotFather token and webhook secret.
4. Add the alert chat ID and allowed admin chat IDs.
5. Enable alerts and user commands only after the public webhook is behind HTTPS.
6. Save settings, then run the Telegram API test.

The dashboard clears token fields after saving. API responses return readiness metadata such as token presence, source, bot username, allowed chat IDs, and last test status. They never return the bot token or webhook secret.

## Runtime Behavior

- Database settings use encrypted `secret_records` with scope `telegram_bot`.
- Environment variables remain a bootstrap/fallback path for existing deployments.
- Telegram API calls use the shared outbound HTTP client and honor `AFROWS_OUTBOUND_PROXY_URL`.
- User-command webhooks still require Telegram's `x-telegram-bot-api-secret-token` header.

## Rotation

1. Generate or reset the token in BotFather.
2. Paste the new token in Settings and save.
3. Run the Telegram API test.
4. Update the Telegram webhook secret if needed.
5. Reconfigure Telegram's webhook endpoint with the matching secret-token header.
6. Confirm alerts and user commands work, then keep the old token out of deployment files and chat history.

Do not commit BotFather tokens, webhook secrets, chat exports, screenshots containing secrets, or production Telegram configuration.
