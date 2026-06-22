# Changelog

All notable GravityLite changes are tracked here.

## 1.0.0

Initial GravityLite release.

### Changed

- Rebranded the application from Antigravity-Manager to GravityLite.
- Updated product metadata, package naming, app title, logo usage, and About page attribution.
- Simplified the UI across settings, accounts, API proxy, user tokens, traffic logs, and modal flows.
- Removed user-facing Model Router controls and broad unused mapping surfaces.
- Fixed frontend and backend model exposure to the explicit GravityLite model set.
- Reworked account quota displays with stable ordering and clearer labels.
- Added clearer user token controls, including IP limit guidance and curfew timezone support.
- Cleaned English-facing UI fallback text and removed leftover development logs from frontend paths.
- Added `NOTICE.md` with upstream attribution and fork metadata.

### Preserved

- Upstream attribution to `lbjlaq/Antigravity-Manager`.
- CC BY-NC-SA 4.0 licensing terms.
- Existing local data directory behavior for `.antigravity_tools`.

### Validation

- Frontend build passes with `npm run build`.
- Rust backend check passes with `cargo check`.
- Some existing Vite chunk warnings and Rust unused-code warnings remain.
