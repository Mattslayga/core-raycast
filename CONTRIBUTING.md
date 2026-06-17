# Contributing

This extension is the official Core Edge Raycast surface for technical users.
Keep changes small, keyboard-first, and honest about unsupported Core Edge API
shapes.

## Development

```sh
bun install
bun run dev
```

## Validation

Run the full local gate before opening a PR:

```sh
bun run typecheck
bun run test
bun run lint
bun run build
```

For npm/Raycast Store compatibility:

```sh
npm install
npm test
npm run lint
npm run build
```

## UX Rules

- Enter should perform the primary action for the current screen.
- Cmd-Enter should expose the most useful secondary action.
- Unsupported backend behavior must be hidden, disabled, or clearly explained.
- Do not add admin-only operations to the public extension.
- Do not shell out to a local `core-edge` binary; use the HTTP API.

## Pull Request Checklist

- No tokens or private Core data in code, tests, docs, logs, or screenshots.
- README or changelog updated for user-visible changes.
- Known limitations updated when backend support is partial.
- Validation commands recorded in the PR.
