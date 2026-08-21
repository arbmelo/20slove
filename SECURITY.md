# Security Policy — From the Love Begins

This document describes the security controls applied to this website and the
recommended hosting-level configuration to complete the full security hardening.

---

## Implemented Controls (Code-Level)

### 🔴 Critical

| Control | Implementation | File |
|---|---|---|
| **Content Security Policy (CSP)** | `<meta http-equiv="Content-Security-Policy">` restricts scripts to `self` + YouTube only; styles to `self` + Google Fonts; frames to YouTube only; blocks `object-src`, `worker-src`, `base-uri` | `index.html` |
| **MIME Sniffing Prevention** | `<meta http-equiv="X-Content-Type-Options" content="nosniff">` | `index.html` |
| **Input Validation & Output Encoding** | All YouTube API data (`title`, `video_id`) is sanitized via `sanitizeText()` and validated with regex before DOM insertion. `trackName` uses `textContent` never `innerHTML`. | `script.js` |
| **XSS — Toast notifications** | `showToast()` rebuilt with DOM API: only `<kbd>` tags are whitelisted; all other input is `textContent`-escaped | `script.js` |
| **XSS — SVG play icon** | `updatePlayIconUI()` uses `createElementNS` + `setAttribute` instead of `innerHTML` | `script.js` |
| **Secure Cookie Utility** | `SecureCookie` wrapper enforces `SameSite=Strict; Secure; Path=/` on any cookies | `script.js` |
| **Principle of Least Privilege** | Removed `window._toggleRain` global — replaced with scoped `CustomEvent` dispatch | `script.js` |
| **Canonical HTTPS hint** | `<link rel="canonical" href="https://yourdomain.com/">` | `index.html` |
| **HTTPS upgrade directive** | `upgrade-insecure-requests` in CSP | `index.html` |

### 🟡 High Priority

| Control | Implementation | File |
|---|---|---|
| **HSTS** | `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` | `_headers`, `.htaccess`, `vercel.json` |
| **X-Frame-Options** | `DENY` — prevents clickjacking | `_headers`, `.htaccess`, `vercel.json` |
| **Referrer-Policy** | `strict-origin-when-cross-origin` — limits referrer data sent to third parties | `_headers`, `.htaccess`, `vercel.json`, `index.html` |
| **Permissions-Policy** | Disables camera, microphone, geolocation, payment, USB | `_headers`, `.htaccess`, `vercel.json`, `index.html` |
| **Sleep timer whitelist** | `data-minutes` validated against `[0,15,30,60,90]` allowlist before use | `script.js` |

### 🔵 Advanced

| Control | Implementation | File |
|---|---|---|
| **Cross-Origin Policies** | `Cross-Origin-Opener-Policy: same-origin-allow-popups` + `Cross-Origin-Resource-Policy: same-site` | `_headers`, `.htaccess`, `vercel.json` |
| **Security disclosure** | RFC 9116 `security.txt` at `/.well-known/security.txt` | `.well-known/security.txt` |
| **Dependency scanning** | `package.json` with `npm audit` script | `package.json` |
| **Google Fonts CORS** | Added `crossorigin` attribute to `<link rel="preconnect">` for proper CORS font handling | `index.html` |
| **Script defer** | `script.js` loaded with `defer` to prevent blocking and reduce attack surface during parse | `index.html` |

---

## Hosting-Level Controls (Required Actions for You)

These cannot be implemented in static files — they require configuration at your
hosting provider or CDN.

### SSL/TLS Certificate
**What to do:** Enable HTTPS/SSL on your hosting provider.
- **Netlify:** Automatic via Let's Encrypt
- **Vercel:** Automatic
- **Cloudflare:** Enable "Full (Strict)" SSL mode in Dashboard > SSL/TLS
- **cPanel/Shared Hosting:** Install free Let's Encrypt cert in SSL/TLS section
- **Nginx/VPS:** `certbot --nginx -d yourdomain.com`

### HSTS Preload
After enabling HTTPS, submit your domain to the browser preload list:
https://hstspreload.org/

### Web Application Firewall (WAF)
- **Cloudflare (Free):** Dashboard > Security > WAF > Enable "Managed Rules"
- **Cloudflare (Pro):** Full OWASP ruleset
- **Netlify:** Pair with Cloudflare as reverse proxy for WAF
- **AWS CloudFront:** Attach AWS WAF with Core Rule Set

### DDoS Protection
- **Cloudflare (Free):** Automatic Layer 3/4 DDoS mitigation
- **Netlify/Vercel:** Built-in basic DDoS protection
- **Advanced:** Cloudflare Pro/Business for Layer 7 rules

### Multi-Factor Authentication (MFA)
- Enable 2FA on your Netlify / Vercel / Cloudflare / cPanel accounts
- Enable 2FA on your GitHub/GitLab code repository account

### Automated Dependency Scanning
- Enable **Dependabot** (GitHub): add `.github/dependabot.yml`
- **Snyk:** connect repo at https://snyk.io
- Run `npm audit` locally after adding any packages

### Data-at-Rest Encryption (AES-256)
- N/A for this site: no database, no server storage, no PII collected
- If you add a backend: use AES-256-GCM for sensitive fields

### Principle of Least Privilege — Hosting
- Use a read-only deploy key for CI/CD
- Restrict CDN/Cloudflare API token to minimum permissions
- Use separate accounts for staging and production

---

## What This Site Doesn't Need (Correct by Design)

| Requirement | Reason Not Applicable |
|---|---|
| Password Hashing (Argon2id/bcrypt) | No user accounts, no authentication |
| Parameterized Queries (SQL Injection) | No database or server-side queries |
| Server-Side Input Validation | No form submissions processed server-side |
| Session Management | No server-side sessions |

---

## Reporting a Vulnerability

- **Email:** arbmeloind@gmail.com
- **Response time:** Within 72 hours
- See `.well-known/security.txt` for the machine-readable version.

---

## Security Checklist Status

| # | Control | Status | Location |
|---|---|---|---|
| 1 | SSL/TLS Certificate | Hosting config | Your hosting provider |
| 2 | Strong Password Hashing | N/A | No accounts |
| 3 | Parameterized Queries | N/A | No database |
| 4 | Framework & Plugin Updates | No deps | `package.json` / `npm audit` |
| 5 | Secure Cookie Flags | Implemented | `script.js` SecureCookie |
| 6 | WAF | Hosting config | Cloudflare / hosting |
| 7 | MFA | Hosting config | Your account settings |
| 8 | HSTS | Implemented | `_headers` / `.htaccess` / `vercel.json` |
| 9 | Content Security Policy | Implemented | `index.html` + header files |
| 10 | Input Validation & Output Encoding | Implemented | `script.js` |
| 11 | Data-at-Rest Encryption | N/A | No server storage |
| 12 | DDoS Protection | Hosting config | Cloudflare / hosting |
| 13 | Automated Dependency Scanning | Implemented | `package.json` + Dependabot |
| 14 | Principle of Least Privilege | Implemented | `script.js` + hosting guidance |
