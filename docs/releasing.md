# Releasing

[中文发布说明](./releasing_zh.md)

This repository uses GitHub Actions to automate GitHub Releases.

## Release flow

1. Update `manifest.json` version if needed.
2. Commit changes to `main`.
3. Create and push a tag:

```powershell
git tag v0.2.0
git push origin v0.2.0
```

4. GitHub Actions will:
   - generate icons
   - run syntax checks
   - build the unpacked distribution zip
   - create a GitHub Release automatically
   - upload the release asset

## Release asset

The uploaded asset is:

- `network-error-reporter-<version>-unpacked.zip`

This is a distribution archive for `Load unpacked`.
It is not a `.crx` installer package.

## Manual trigger

You can also trigger the workflow manually from the GitHub Actions tab with `workflow_dispatch`.
