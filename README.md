# Core Edge for Raycast

[![CI](https://github.com/Mattslayga/core-raycast/actions/workflows/ci.yml/badge.svg)](https://github.com/Mattslayga/core-raycast/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Official Raycast extension for technical Core Edge users who want fast,
keyboard-first access to The Core from Raycast.

This repository is intended for source/dev-mode distribution first. It is not
yet a public Raycast Store install.

## Status

- **Distribution stage:** public OSS dev-mode beta.
- **Audience:** technical Core Edge users comfortable with Git, terminal, and
  Raycast development mode.
- **Auth:** Core Edge API token stored in Raycast password preferences.
- **Data posture:** direct Core Edge HTTP API calls; no local `core-edge` binary
  dependency; no admin-only operations.
- **Store status:** not submitted to the Raycast Store yet.

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

## Quick Start

Use npm if you want to follow the same package manager path Raycast uses for
Store builds:

```sh
git clone https://github.com/Mattslayga/core-raycast.git
cd core-raycast
npm install
npm run dev
```

Or use Bun for the faster local loop:

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

## Token Guidance

Use a per-user Core Edge token. Do not share tokens between users.

- `read` tokens can search, read, browse, and inspect work surfaces.
- `write` tokens can also capture records, create links, and update tasks.
- `admin` tokens are not required and should not be used for this extension.

The extension stores the token in Raycast as a password preference. Never paste
tokens into GitHub issues, screenshots, pull requests, or logs.

## Commands

The first beta exposes the Core daily toolkit:

- `Search Core`
- `Explore Core`
- `Quick Capture`
- `Link Records`
- `What Next`
- `Open Loops`
- `Agenda`
- `Recent`
- `Project Context`
- `Browse Records`

Write actions such as capture, link creation, task status changes, scheduling,
blocking, unblocking, and appending task notes require a write-capable Core Edge
token. Read tokens can still use search, read, browse, graph, agenda, recent,
and project context surfaces.

## Validation

Recommended npm validation:

```sh
npm run validate
```

Equivalent Bun validation:

```sh
bun run validate:bun
```

Expanded validation commands:

```sh
npm run typecheck
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

## Troubleshooting

### Raycast Does Not Show the Extension

- Make sure `npm run dev` or `bun run dev` is still running.
- Open Raycast and search for one of the commands, such as `Search Core`.
- If Raycast is already running another development copy, stop the old process
  and restart the dev command from this repository.

### Preferences Keep Appearing

- Confirm `Core Edge Base URL` is a full URL, such as
  `https://core-edge.up.railway.app`.
- Confirm the API token is pasted into the password preference.
- Leave `Namespace` blank unless your token requires an explicit namespace.

### Requests Fail

- Run a read-only command first, such as `Search Core`.
- Confirm your token role matches the action: read tokens cannot capture, link,
  or update tasks.
- Do not paste tokens into issues. If a token appears in a bug report or
  screenshot, revoke it.

### Fresh Install Check

This is the clean-room install path maintainers use before inviting beta users:

```sh
git clone https://github.com/Mattslayga/core-raycast.git
cd core-raycast
npm ci
npm test
npm run lint
npm run build
```

## Known Limitations

- The first public path uses Core Edge API tokens, not OAuth.
- Unsupported typed-link shapes are shown as unavailable in Raycast. They are
  not silently forced through the API.
- Some legacy wiki links only contain a title. The extension resolves the best
  matching note before opening and falls back to candidate search if ambiguous.
- Store screenshots and public issues must not include private Core content.
- Admin operations are intentionally out of scope for the first public version.

## Support

Use GitHub issues for reproducible bugs and focused feature requests. Include:

- command name,
- expected behavior,
- actual behavior,
- Core Edge server version if known,
- token role (`read` or `write`, never the token itself),
- sanitized screenshots only when helpful.

Do not include private Core record content, raw API tokens, full server responses
with private data, or screenshots of Raycast preferences.

## Store Readiness

This repository is ready for technical users to run locally in Raycast
development mode. Public Raycast Store submission is a later maintainer action
after beta feedback, sanitized screenshots, metadata review, and Core Edge API
compatibility confirmation.
