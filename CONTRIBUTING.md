# Contributing

[中文贡献指南](./CONTRIBUTING_zh.md)

Thanks for contributing to Network Error Reporter.

## Development setup

1. Clone the repository.
2. Open `chrome://extensions`.
3. Enable Developer Mode.
4. Click `Load unpacked`.
5. Select this project directory.
6. Open any page's DevTools and switch to the `Error Report` panel.

## Project structure

- `panel/main.js`: panel interaction and rendering
- `panel/report.js`: request normalization and report generation
- `panel.html` / `panel.css`: panel UI
- `scripts/`: packaging and asset generation helpers

## Before submitting a PR

1. Reload the extension in Chrome.
2. Verify the core flow:
   - request list loads
   - `Fetch/XHR` filtering works
   - selecting a request updates the report preview
   - `复制 Markdown` works
   - `导出图片` can copy or download successfully
3. Run syntax checks:

```powershell
node --check .\panel\main.js
node --check .\panel\report.js
```

## Pull request expectations

- Keep changes focused.
- Explain the user-facing impact.
- Include verification steps.
- Add screenshots for UI changes when relevant.

## Discussions

- Use Issues for bugs and feature requests.
- Use pull requests for implementation proposals.
