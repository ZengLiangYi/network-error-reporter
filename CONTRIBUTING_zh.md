# Contributing

[English Contributing Guide](./CONTRIBUTING.md)

感谢你为 Network Error Reporter 做出贡献。

## 开发环境

1. 克隆仓库。
2. 打开 `chrome://extensions`。
3. 开启 Developer Mode。
4. 点击 `Load unpacked`。
5. 选择当前项目目录。
6. 打开任意页面的 DevTools，并切换到 `Error Report` 面板。

## 项目结构

- `panel/main.js`: 面板交互与渲染
- `panel/report.js`: 请求归一化与报告生成
- `panel.html` / `panel.css`: 面板 UI
- `scripts/`: 打包与资源生成脚本

## 提交 PR 前请确认

1. 在 Chrome 中重新加载扩展。
2. 验证核心流程：
   - 请求列表可以正常加载
   - `Fetch/XHR` 筛选正常
   - 选择请求后会更新报告预览
   - `复制 Markdown` 正常
   - `导出图片` 可以复制或下载成功
3. 运行语法检查：

```powershell
node --check .\panel\main.js
node --check .\panel\report.js
```

## Pull Request 期望

- 保持变更聚焦。
- 说明用户可感知的影响。
- 附上验证步骤。
- 如果涉及 UI 变更，请附截图。

## 讨论方式

- Bug 和功能建议请走 Issues。
- 实现方案请走 Pull Requests。
