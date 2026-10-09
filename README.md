# Clean Paste

**Remove private info before you paste into AI.**

**Live:** https://gfxroy.github.io/clean-paste/

![Clean Paste](docs/screenshot.png)

Paste a log, an email thread, a support ticket or some code. Clean Paste swaps out the private parts for neat placeholders like `[EMAIL_1]` and `[KEY_1]`, so you can paste the clean copy into ChatGPT, Claude or Gemini. Then paste the AI's reply back in and the originals are restored.

## Features

- **Instant cleaning as you type.** Placeholders are numbered consistently, so the same email is always `[EMAIL_1]`.
- **What it catches:**
  - emails
  - phone numbers (Indian +91, US, international)
  - card numbers (Luhn-checked)
  - API keys and tokens (OpenAI, AWS, GitHub, Google, Slack, Stripe, JWTs, private keys, `password=` values, generic high-entropy strings)
  - IPv4/IPv6 addresses
  - URLs carrying tokens or credentials
  - Aadhaar, PAN and SSN numbers
  - simple street addresses and PIN codes
- **A one-line summary** such as "Removed 2 emails, 1 key".
- **Restore.** Paste the AI's reply and the placeholders turn back into the real values. It works with or without the brackets.
- **Category toggles** so you can keep whatever you want to leave in.

## Privacy

Everything runs in your browser. Nothing is uploaded, logged or stored. The placeholder mapping only lives in memory and is gone when you close the tab.

This is pattern matching, not a guarantee. Read the clean text before you share it.

## Develop

```bash
npm install
npm run dev     # local dev server
npm test        # detector tests (Vitest)
npm run build
```

Built with Vite, React and TypeScript, and deployed to GitHub Pages with GitHub Actions.

## License

MIT © Aaditya Roy
