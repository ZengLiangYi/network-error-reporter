# Network Error Reporter

一个可直接加载到 Chrome 的 DevTools 扩展，用来把网络请求整理成结构化错误报告，并支持直接导出为图片。

## v1 范围

- 在 DevTools 中新增 `Error Report` 面板
- 读取 HAR 和新完成的请求
- 默认展示最近失败的 `Fetch/XHR` 请求，可切换资源分类和查看全部请求
- 选中请求后生成 Markdown 报告
- 手动补充影响评估和复现说明
- 复制 Markdown 报告到剪贴板
- 导出报告图片
- 检测敏感字段并在复制前二次确认

已确认不做：

- 网络面板截图
- 扩展内生成 cURL
- HAR 导出
- 同类请求聚合

## 本地使用

1. 打开 `chrome://extensions`
2. 开启“开发者模式”
3. 选择“加载已解压的扩展程序”
4. 选择当前目录：`C:\Users\Rayner\Project\network-error-reporter`
5. 打开任意页面的 DevTools，切到 `Error Report` 面板

## 打包发布

执行下面的命令会生成一个可分发的 zip 包：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-extension.ps1
```

产物位置：

- `release\network-error-reporter-<version>\`
- `release\network-error-reporter-<version>.zip`

首次打包前如需重新生成图标：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-icons.ps1
```

## 说明

- Chrome DevTools 扩展 API 无法直接读取 Network 面板“当前选中的请求”，所以 v1 使用“面板内请求列表 + 手动选择”的交互。
- 如果需要 cURL，请直接在 Chrome Network 面板使用原生 `Copy as cURL`。
- 导出图片优先尝试写入剪贴板，若浏览器策略不允许，则自动下载 `.png` 文件。
- 当前 UI 采用原生模块化前端结构：`panel/main.js` 负责交互编排，`panel/report.js` 负责请求归一化与报告生成。
- 隐私与发布信息分别见 `PRIVACY.md` 和 `RELEASE.md`。
