# Security Policy

## Reporting

Report security issues privately to the Core Edge maintainers. Do not open a
public GitHub issue containing secrets, tokens, private Core records, screenshots
with private data, or exploit details.

## Token Handling

- Use one Core Edge API token per user.
- Prefer `read` tokens for cautious testers.
- Use `write` tokens only for trusted users who need capture/task/link actions.
- Do not use `admin` tokens in Raycast.
- Revoke any token that is pasted into chat, logs, issues, screenshots, or pull
  requests.

## Data Handling

The extension sends requests directly from Raycast to the configured Core Edge
base URL. It does not shell out to the local `core-edge` CLI and does not bundle
or export Core data.

## Screenshots and Issues

Before sharing screenshots or bug reports:

- Remove private record titles, content, tags, IDs, and API links.
- Do not include Raycast preferences if the token field is visible.
- Do not paste raw server responses that may contain private Core content.
