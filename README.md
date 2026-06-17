# Core Edge for Raycast

Official Raycast extension for technical Core Edge users who want fast,
keyboard-first access to The Core from Raycast.

This repository is intended for source/dev-mode distribution first. It is not
yet a public Raycast Store install.

## What It Does

- Search Core with hybrid retrieval.
- Read records and notes inside Raycast.
- Browse notes, tasks, projects, people, organisations, and opportunities.
- Explore typed and legacy links.
- Capture notes, tasks, projects, people, organisations, and opportunities.
- Add supported links while capturing records.
- Create supported typed links between existing records.
- Review what is next, agenda items, recent changes, project context, and open
  loops.
- Update task status, schedule tasks, block/unblock tasks, and append task
  notes when your token has write access.

## Requirements

- macOS with Raycast installed.
- Git.
- Bun for the recommended development flow.
- Node.js/npm for Store-prep compatibility checks.
- A Core Edge server URL.
- A Core Edge API token for your own namespace.

## Token Guidance

Use a per-user Core Edge token. Do not share tokens between users.

- `read` tokens can search, read, browse, and inspect work surfaces.
- `write` tokens can also capture records, create links, and update tasks.
- `admin` tokens are not required and should not be used for this extension.

The extension stores the token in Raycast as a password preference. Never paste
tokens into GitHub issues, screenshots, pull requests, or logs.

## Local Setup

```sh
git clone https://github.com/Mattslayga/core-raycast.git
cd core-raycast
bun install
bun run dev
```

Raycast will show the extension in development mode. Open any Core command and
configure preferences when prompted:

- `Core Edge Base URL`
- `Core Edge API Token`
- optional `Namespace`
- `Result Limit`

## Validation

Recommended Bun validation:

```sh
bun run typecheck
bun run test
bun run lint
bun run build
```

Npm compatibility validation:

```sh
npm install
npm test
npm run lint
npm run build
```

## Updating

```sh
git pull
bun install
bun run dev
```

Restart the Raycast development command after manifest or command changes.

## Known Limitations

- The first public path uses Core Edge API tokens, not OAuth.
- Unsupported typed-link shapes are shown as unavailable in Raycast. They are
  not silently forced through the API.
- Some legacy wiki links only contain a title. The extension resolves the best
  matching note before opening and falls back to candidate search if ambiguous.
- Store screenshots and public issues must not include private Core content.
- Admin operations are intentionally out of scope for the first public version.
- `npm audit` currently reports an upstream `esbuild` advisory through
  `@raycast/api`. npm suggests downgrading Raycast API to fix it; do not do
  that for Store prep without first checking current Raycast guidance.

## Raycast Store Publishing

Ordinary users should not run the publish script. It is for maintainers preparing
a public Raycast Store PR.

Before publishing:

- Confirm the Raycast author/owner metadata.
- Replace or approve the final 512x512 icon.
- Capture sanitized screenshots.
- Confirm npm lockfile freshness.
- Run `npm test`, `npm run lint`, and `npm run build`.
- Review `npm audit` and document any Raycast upstream/transitive advisories.
- Confirm the minimum supported Core Edge server version.

Publishing uses:

```sh
npm run publish
```

That command opens a public Raycast Store review PR. Do not run it until the
extension is intentionally ready for Store review.
