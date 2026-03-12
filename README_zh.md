# Network Error Reporter

[English README](./README.md) | [贡献指南](./CONTRIBUTING_zh.md) | [发布说明](./docs/releasing_zh.md)

一个 Chrome DevTools 扩展，用来把网络失败请求整理成可直接分享的结构化报告。

## 为什么做这个工具

当 Chrome DevTools 里的请求失败时，团队通常会用截图加手写说明来沟通问题。这种方式慢、重复，而且经常缺上下文。

Network Error Reporter 会把一次失败请求转换成：

- 结构化 Markdown 报告
- 可读的真实报告预览
- 可导出的报告图片

目标很直接：减少前后端在 API 排查过程中的来回沟通成本。

## 功能特性

- 在 Chrome DevTools 中新增 `Error Report` 面板
- 读取 HAR 和新完成的请求
- 默认聚焦失败的 `Fetch/XHR` 请求
- 提炼有价值的请求/响应信息，而不是原样搬运 DevTools 噪音
- 支持补充影响范围、错误频率、复现说明和备注
- 一键复制 Markdown
- 导出渲染后的报告图片
- 分享前提示潜在敏感字段

## 核心流程

1. 打开 Chrome DevTools。
2. 切换到 `Error Report` 面板。
3. 在列表中选择一条失败请求。
4. 检查生成后的报告。
5. 复制 Markdown 或导出图片。

## 项目现状

当前范围：

- 单请求报告
- 按资源类型筛选请求
- 结构化预览与导出

当前不包含：

- Network 面板截图采集
- 内置 cURL 生成
- HAR 导出
- 多请求聚合分析

## 本地开发

1. 打开 `chrome://extensions`。
2. 开启 Developer Mode。
3. 点击 `Load unpacked`。
4. 选择当前项目目录。
5. 打开任意页面的 DevTools，切到 `Error Report` 面板。

## 打包分发

如需重新生成图标：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-icons.ps1
```

打包分发目录：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-extension.ps1
```

产物：

- `release\network-error-reporter-<version>-unpacked\`
- `release\network-error-reporter-<version>-unpacked.zip`

注意：

- 生成的 zip 是用于 GitHub 或文件分享的分发压缩包
- Chrome 不能直接把这个 zip 当作已打包扩展安装
- 正确使用方式是先解压，再通过 `Load unpacked` 加载解压目录
- 真正可安装的 `.crx` 需要 Chrome 自带打包流程和签名密钥管理

## 自动发布

这个项目支持通过 GitHub Actions 自动发布 GitHub Releases。

- 推送类似 `v0.2.0` 的 tag
- GitHub Actions 会自动构建分发 zip 并发布 Release

发布文档：

- [docs/releasing_zh.md](./docs/releasing_zh.md)

## 项目结构

- `panel/main.js`: 面板交互与预览渲染
- `panel/report.js`: 请求归一化与报告生成
- `panel.html` / `panel.css`: 面板 UI
- `scripts/`: 打包和资源辅助脚本

## 说明

- Chrome DevTools 扩展无法直接读取原生 Network 面板当前选中的请求，所以本项目使用自己的请求列表进行选择。
- 如果你需要 cURL，请直接使用 Chrome Network 面板原生的 `Copy as cURL`。
- 图片导出会优先尝试复制到剪贴板，失败时会回退为下载 `.png` 文件。

## 社区

- 贡献指南：[CONTRIBUTING_zh.md](./CONTRIBUTING_zh.md)
- 行为准则：[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- 安全策略：[SECURITY.md](./SECURITY.md)

## 许可证

[MIT](./LICENSE)
