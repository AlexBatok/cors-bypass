# CORS Pro — Fast CORS Unblock for Developers

A Chrome extension that bypasses CORS errors per-site using `declarativeNetRequest`. Zero CPU overhead when inactive — no background scripts polling, no content scripts injected.

## Features

- **Per-site toggle** — enable CORS bypass only where you need it
- **Zero overhead** — uses `declarativeNetRequest` (no background listeners when idle)
- **Smart protection** — blocks YouTube, Google, GitHub etc. by default to prevent breakage
- **Debug panel** — see how many requests were modified
- **Configurable headers** — choose which CORS headers to inject
- **Export/Import** — sync settings across devices
- **Dark & light theme** — follows system preference

## Install

### From Chrome Web Store
*(Coming soon)*

### Manual (Developer Mode)
1. Clone this repository
2. `npm install && npm run build`
3. Open `chrome://extensions`, enable Developer Mode
4. Click "Load unpacked" and select the `extension/` folder

## Development

```bash
npm install          # Install dependencies
npm run build        # Production build
npm run watch        # Watch mode (auto-rebuild on save)
node build-zip.mjs   # Create ZIP for Chrome Web Store
```

## Architecture

```
extension/
  manifest.json                    # MV3 manifest
  src/
    background.ts                  # Service worker
    lib/
      constants.ts                 # Types, defaults, config
      storage.ts                   # chrome.storage.local wrapper
      rules.ts                     # declarativeNetRequest builder
      blocklist.ts                 # Protected domains
      icon.ts                      # Per-tab icon/badge
      theme.css                    # Shared CSS variables
    popup/                         # Extension popup UI
    options/                       # Settings page
  icons/                           # Active/inactive PNGs + SVG sources
  _locales/en/messages.json        # i18n
```

**How it works:** When you enable CORS for a domain, the extension adds `declarativeNetRequest` dynamic rules that set CORS response headers (`Access-Control-Allow-Origin: *`, etc.) on all responses from that domain. Rules persist across browser restarts. When disabled, rules are removed — zero runtime cost.

## Tech Stack

- TypeScript (compiled with esbuild)
- Manifest V3, Chrome 120+
- No frameworks — vanilla DOM for popup and options

## License

MIT
