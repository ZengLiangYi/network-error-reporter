# Releasing

[English Release Guide](./releasing.md)

这个仓库使用 GitHub Actions 自动化 GitHub Releases。

## 发布流程

1. 如有需要，先更新 `manifest.json` 版本号。
2. 将变更提交到 `main`。
3. 创建并推送 tag：

```powershell
git tag v0.2.0
git push origin v0.2.0
```

4. GitHub Actions 会自动：
   - 生成图标
   - 运行语法检查
   - 构建未打包分发 zip
   - 自动创建 GitHub Release
   - 上传发布资产

## 发布产物

上传的资产为：

- `network-error-reporter-<version>-unpacked.zip`

这是用于 `Load unpacked` 的分发压缩包，不是 `.crx` 安装包。

## 手动触发

你也可以在 GitHub Actions 页面通过 `workflow_dispatch` 手动触发。
