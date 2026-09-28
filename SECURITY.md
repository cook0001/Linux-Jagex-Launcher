# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Security Model & Principles

1. **Zero External Servers**: This launcher runs 100% on the client side. No credentials, tokens, or personal information are ever dispatched to any intermediate or third-party servers.
2. **Direct Jagex OAuth 2.0 PKCE**: All authentication is performed directly with official Jagex endpoints (`account.jagex.com`). Passwords are typed into official Jagex forms and are never handled or logged by the launcher.
3. **Local Credential Storage**: Session tokens are held strictly on your local filesystem under `~/.config/linux-jagex-launcher/` with restricted user permissions (`0600`/`0700`).

## Reporting a Vulnerability

If you discover a security vulnerability within the Linux Jagex Launcher, please do **NOT** open a public issue.

Instead:
1. Please report vulnerabilities privately via [GitHub Private Vulnerability Reporting](https://github.com/cook0001/Linux-Jagex-Launcher/security/advisories/new).
2. Alternatively, contact the maintainer directly through GitHub profile contact options.

We take security seriously and will investigate and address reported issues promptly.
