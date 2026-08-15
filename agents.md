# agents.md

## Package manager: pnpm

- This project uses **pnpm**. Do not use `npm`, `yarn`, or `bun` for installing dependencies, running scripts, or managing lockfiles.
- `pnpm-lock.yaml` is authoritative and must be committed in sync with `package.json`. If a stale `package-lock.json` exists, ignore it — do not update or treat it as canonical.

## No emojis anywhere

- Never use emoji characters in the project: not in code, comments, documentation, UI copy, commit messages, or file names.
- Exception: when reproducing example/sample data verbatim (e.g., quoted WhatsApp messages in `benchmarks/`), keep the original characters exactly as they appear.
