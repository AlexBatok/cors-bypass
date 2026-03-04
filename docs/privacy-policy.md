# Privacy Policy — CORS Bypass

**Last updated:** March 4, 2026

## Overview

CORS Bypass ("the Extension") is a Chrome browser extension that modifies HTTP response headers to bypass CORS (Cross-Origin Resource Sharing) restrictions during web development. This privacy policy explains what data the Extension collects, stores, and transmits.

## Data Collection

**CORS Bypass collects zero user data.**

- No personal information is collected
- No browsing history is recorded
- No analytics or telemetry data is gathered
- No tracking pixels, cookies, or fingerprinting is used
- No data is transmitted to external servers

## Data Storage

The Extension stores the following data **locally on your device** using Chrome's `chrome.storage.local` API:

- **Enabled domains** — the list of hostnames where you have activated CORS bypass
- **Settings** — your CORS header preferences (which headers to inject)
- **Custom blocklist** — any domains you have added to the protection list

This data never leaves your browser. It is not synced, uploaded, or shared with any third party.

## Permissions

The Extension requests the following Chrome permissions:

| Permission | Purpose |
|------------|---------|
| `declarativeNetRequest` | Modify HTTP response headers to inject CORS headers on enabled domains |
| `declarativeNetRequestFeedback` | Display the count of modified requests in the popup debug panel |
| `storage` | Save your enabled domains and settings locally |
| `activeTab` | Detect the hostname of the currently active tab |
| `host_permissions: <all_urls>` | Apply CORS header modifications to any domain the user enables |

## Network Activity

- The Extension does **not** make any network requests
- The Extension does **not** communicate with any external server
- The Extension works **100% offline**
- All processing happens locally in your browser via Chrome's declarativeNetRequest API

## Third-Party Services

The Extension does **not** use any third-party services, SDKs, libraries, or APIs that collect data.

## Content Scripts

The Extension does **not** inject any content scripts into web pages. It only modifies HTTP response headers at the network level using Chrome's declarativeNetRequest API.

## Children's Privacy

The Extension does not collect any data from any users, including children under the age of 13.

## Changes to This Policy

If this privacy policy is updated, the changes will be posted on this page with an updated "Last updated" date. The Extension does not collect email addresses, so there is no way to notify users of policy changes — please check this page periodically.

## Contact

If you have questions about this privacy policy, please open an issue on the project's GitHub repository.
