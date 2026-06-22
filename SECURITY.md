# Security Policy

GravityLite manages sensitive local account and proxy data. Treat every account file, token, API key, debug log, and exported configuration as private.

## Supported Version

Security fixes are currently handled for the latest GravityLite release line.

| Version | Supported |
| --- | --- |
| 1.0.x | Yes |

## Reporting a Vulnerability

If you find a security issue, please do not open a public GitHub issue with secrets, exploit details, or reproducible payloads that expose user data.

Report privately to the maintainer:

- GitHub: https://github.com/bernardthimotius
- LinkedIn: https://www.linkedin.com/in/bernardtrnp/

Please include:

- A concise description of the issue.
- Affected platform and version.
- Reproduction steps without real credentials.
- Impact assessment.
- Any relevant logs with secrets removed.

## Sensitive Data

Do not publish or commit:

- API keys.
- User tokens.
- OAuth refresh tokens.
- Account export files.
- `.antigravity_tools` contents.
- Debug logs containing request or response payloads.
- Screenshots that reveal tokens, emails, account IDs, or local paths.

## Local Operation Notes

GravityLite is designed as a local desktop application and proxy manager. If you expose the proxy to a network, you are responsible for authentication, firewalling, token rotation, and access control.

Recommended practices:

- Keep the proxy bound to localhost unless remote access is strictly required.
- Rotate API keys and user tokens regularly.
- Use IP limits for shared user tokens.
- Disable debug logging unless troubleshooting.
- Remove secrets before sharing logs or screenshots.

## Disclaimer

GravityLite is provided under the terms of the project license without warranty. Users are responsible for compliance with the terms of any upstream services they connect to.
