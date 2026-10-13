# 流明市场 · Lumen Market

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 提供 npm 与 GitHub 插件发现、兼容性查验和安装管理。

[npm · 0.5.1](https://www.npmjs.com/package/dsh-lumen-market) · [问题反馈](https://github.com/Femad-6/dsh-lumen-market/issues)

## 功能

- 搜索 npm 与 GitHub 插件，查看介绍、源码和文档。
- 发现页只展示未安装插件，每页 21 项，支持来源筛选和 GitHub 排序。
- 安装前查验兼容性，通过 DSH 官方管理器安装、更新和卸载。
- 查看已安装插件与可用更新，显示操作进度和重启提醒。
- 本地保存发现结果，查询失败或限流时继续显示缓存。

## 安装

在 DSH 的「插件 → 添加插件」中输入：

```text
dsh-lumen-market@0.5.1
```

按官方管理器提示完成安装。需要支持官方插件管理器的 DeepSeek Harness；Node.js 22 或更高版本。

## 许可证

[MIT](LICENSE)
