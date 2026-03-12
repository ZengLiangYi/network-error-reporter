# Network Error Reporter

[中文说明](./README_zh.md) | [Contributing](./CONTRIBUTING.md) | [Releasing](./docs/releasing.md)

A Chrome DevTools extension for turning network failures into structured reports that frontend and backend engineers can share immediately.

## Why

When a request fails in Chrome DevTools, teams usually pass around screenshots plus manually written context. That is slow, repetitive, and often incomplete.

Network Error Reporter turns a failed request into:

- a structured Markdown report
- a readable report preview
- an exportable report image

The goal is simple: reduce the back-and-forth between frontend and backend during API debugging.

## Features

- adds an `Error Report` panel inside Chrome DevTools
- reads HAR entries and newly finished requests
- defaults to failed `Fetch/XHR` requests
- extracts useful request and response details instead of copying DevTools noise
- lets you add impact scope, frequency, repro notes, and remarks
- copies Markdown with one click
- exports the rendered report as an image
- highlights possible sensitive fields before sharing

## Core flow

1. Open Chrome DevTools.
2. Switch to the `Error Report` panel.
3. Select a failed request from the list.
4. Review the generated report.
5. Copy Markdown or export an image.

## Project status

Current scope:

- single-request reporting
- request filtering by resource type
- structured preview and export

Not included:

- screenshot capture from the Network panel
- built-in cURL generation
- HAR export
- multi-request aggregation

## Local development

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click `Load unpacked`.
4. Select this project directory.
5. Open any page's DevTools and switch to the `Error Report` panel.

## Packaging

Generate icons if needed:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-icons.ps1
```

Package the extension:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-extension.ps1
```

Artifacts:

- `release\network-error-reporter-<version>-unpacked\`
- `release\network-error-reporter-<version>-unpacked.zip`

Important:

- the generated zip is a distribution archive for GitHub or file sharing
- Chrome cannot install this zip directly as a packaged extension
- to use it, unzip it first and then load the extracted folder through `Load unpacked`
- a real installable `.crx` package requires Chrome's own packaging flow and signing key management

## Automated releases

This project supports automated GitHub Releases through GitHub Actions.

- push a tag like `v0.2.0`
- GitHub Actions will build the distribution zip and publish a Release automatically

Release documentation:

- [docs/releasing.md](./docs/releasing.md)

## Architecture

- `panel/main.js`: panel interaction and preview rendering
- `panel/report.js`: request normalization and report generation
- `panel.html` / `panel.css`: panel UI
- `scripts/`: packaging and asset helpers

## Notes

- Chrome DevTools extensions cannot directly read the currently selected request in the native Network panel, so this project uses its own request list for selection.
- If you need cURL, use Chrome Network panel's native `Copy as cURL`.
- Image export first tries clipboard output, then falls back to downloading a `.png` file.

## Community

- Contribution guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Security policy: [SECURITY.md](./SECURITY.md)

## License

[MIT](./LICENSE)
