# Release Checklist

## Before packaging

1. 在 `chrome://extensions` 中重新加载当前扩展。
2. 打开任意页面的 DevTools，验证以下流程：
   - 能看到 `Error Report` 面板
   - `Fetch/XHR` 筛选正常
   - 选中请求后自动生成报告
   - `复制 Markdown` 正常
   - `导出图片` 至少能复制或下载成功
3. 检查 `manifest.json` 中的版本号。

## Package

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-extension.ps1
```

产物：

- `release\network-error-reporter-<version>\`
- `release\network-error-reporter-<version>.zip`

## Chrome Web Store materials

- 扩展名称：`Network Error Reporter`
- 简短描述：
  `Generate structured network incident reports from Chrome DevTools.`
- 隐私说明：使用 [PRIVACY.md](C:/Users/Rayner/Project/network-error-reporter/PRIVACY.md)
- 图标：使用 `icons/icon128.png`

## Notes

- 该扩展是 DevTools 扩展，不会在浏览器工具栏中显示业务入口。
- Chrome Web Store 提交流程通常还需要额外截图与商店文案，这些不包含在当前仓库中。
