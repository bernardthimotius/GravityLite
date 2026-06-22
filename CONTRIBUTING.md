# Contributing to GravityLite

Thank you for your interest in improving GravityLite. This project is a focused fork, so contributions should preserve the goal of keeping the application simpler, clearer, and easier to maintain.

## Project Direction

GravityLite prioritizes:

- Clear account and quota management.
- A stable local proxy experience.
- A fixed, understandable model surface.
- Minimal UI with fewer unnecessary controls.
- Safe handling of credentials and local account data.
- Clear attribution to the upstream project.

GravityLite does not prioritize:

- Adding broad model-router complexity back into the UI.
- Adding experimental features without a strong maintenance reason.
- Adding visual clutter or decorative UI that does not improve operation.
- Committing secrets, account exports, or local runtime data.

## Development Setup

Install dependencies:

```bash
npm install
```

Run the app in development:

```bash
npm run tauri dev
```

Build the frontend:

```bash
npm run build
```

Check the Rust backend:

```bash
cd src-tauri
cargo check
```

## Contribution Guidelines

- Keep changes small and focused.
- Explain why the change is needed.
- Preserve upstream attribution and license references.
- Do not commit generated secrets, local account data, debug logs, or `.antigravity_tools` files.
- Prefer neutral, minimal UI changes that match the current GravityLite design language.
- Run validation before submitting changes.

## Pull Request Checklist

Before opening a pull request, confirm:

- The frontend builds with `npm run build`.
- The backend checks with `cargo check` if Rust files changed.
- New UI text is English by default unless it belongs to a locale file.
- No credentials or local user data are included.
- Any behavior change is documented in `CHANGELOG.md` when appropriate.

## Licensing

GravityLite is adapted from Antigravity-Manager and remains under CC BY-NC-SA 4.0. Contributions are accepted under the same license terms.
