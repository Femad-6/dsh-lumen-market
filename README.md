# 流明市场 · Lumen Market

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 提供 npm 与 GitHub 插件发现、兼容性查验和安装管理。

[npm](https://www.npmjs.com/package/dsh-lumen-market) · [问题反馈](https://github.com/Femad-6/dsh-lumen-market/issues)

源码版本：**[0.5.3](https://github.com/Femad-6/dsh-lumen-market/tree/v0.5.3)**。

截至 2026-10-20 核验，npm 官方源的 `latest` 为 **0.5.2**；`0.5.3` 已提交发布，尚未确认公开可下载。当前按下方 `0.5.2` 安装，新版内容见[更新记录](CHANGELOG.md#053--2026-10-20)。

## 功能

- 搜索 npm 与 GitHub 插件，查看介绍、源码和文档。
- 发现页只展示未安装插件，每页 21 项，支持来源筛选和 GitHub 排序。
- 不输入关键词时，选择「GitHub 星标最多」即可查看 `dsh-plugin` 范围内总 Star 最多的插件。
- 支持「GitHub 一周 Star 增长最多」：对匹配范围内总 Star 排名前列的最多 50 个候选统计周增量，再按新增 Star 排序。卡片显示「近7天 +N」；按 GitHub 提供的完整日数据统计，截止昨日，不是精确滚动 168 小时，也不是全 GitHub 周增榜。
- 安装前查验兼容性，通过 DSH 官方管理器安装、更新和卸载。
- 在发现卡片或详情中点击「一键安装」，自动查验目标，通过后直接安装；也可使用「安装预览」先查看目标。尚未查验的 GitHub 候选支持直接发起查验，查验失败会显示原因并停止安装。
- 查看已安装插件与可用更新，显示操作进度和重启提醒；可升级插件显示小灯提示。
- 已安装页支持按名称、简介即时搜索，忽略大小写，支持清空；本地筛选不需要联网。
- 切换标签或离开流明市场后会清空搜索词，并将来源、排序、页码和「仅可安装」恢复默认，再进入时显示未搜索的列表。
- 本地保存发现结果，查询失败或限流时继续显示缓存。
- 保存成功查验过的安装目标。遇到网络故障、超时或限流时，可从缓存发起安装，界面显示「使用缓存安装」和缓存时间；npm 固定确切版本，GitHub 固定 commit。缓存按 DSH 配置隔离，重启后仍可使用。

## 安装

在 DSH 的「插件 → 添加插件」中输入：

```text
dsh-lumen-market@0.5.2
```

按官方管理器提示完成安装。需要支持官方插件管理器的 DeepSeek Harness；Node.js `^22.19.0 || >=24.0.0`。

安装后从侧栏打开「流明市场」，在发现页搜索插件，点击「一键安装」或先查看「安装预览」；在已安装页搜索、管理插件，在可更新页检查版本。按宿主提示正常退出并重启 DSH，使插件生效。

如果默认 npm 镜像尚未同步目标版本，可在官方插件管理器中使用 npm 官方源安装包链接：

```text
https://registry.npmjs.org/dsh-lumen-market/-/dsh-lumen-market-0.5.2.tgz
```

## 使用须知

- npm 来源支持检查版本更新；本地链接和 Git 来源暂不支持按包名升级。
- 当前 DSH 宿主可能禁止在配置运行时覆盖已有依赖，并返回 `already-installed`。市场会明确提示停止当前配置后通过官方插件管理器升级；显示新版不代表宿主支持运行中升级。
- Star 数目前仅显示在 GitHub 来源的结果中。
- GitHub 查询可能受到限流；已有缓存时会继续展示，并标注缓存时间。
- 周增榜按同一批候选分页，统计结果缓存 15 分钟；「重新检查」可主动刷新。界面显示成功统计数量与时间，未知增量排在末尾；全部统计失败时保留同查询的已有缓存。
- 缓存安装仅适用于已经成功查验并保存过的目标；仅有名称、简介的搜索记录不足以安装。仍会检查本机兼容性、来源冲突和已安装状态，明确的无效清单、目标不存在或官方拒绝不会用旧缓存绕过。下载插件及依赖仍需网络；不提供离线升级。
- 截图中的背景和配色来自 DSH 宿主主题，不是插件自带皮肤。

[更新记录](CHANGELOG.md)

## 兼容性与权限

Node.js 支持范围为 `^22.19.0 || >=24.0.0`；DSH 的明确版本声明和逐版本验收状态见 `package.json` 的 `dsh.compatibility`。本插件需要读取 Profile、写入本地缓存和访问 npm/GitHub，可选使用专用 GitHub Token，并通过官方管理器执行插件变更。建议商城采用 `user-reviewed` 策略；权限声明不代表自动审核通过。

详细说明：[依赖、外部服务与失败边界](docs/STORE-REVIEW.md) · [隔离 Profile 验收结果](docs/STORE-VALIDATION.md)。

## 界面预览

**发现插件**

![搜索 npm 与 GitHub 插件](docs/screenshots/discover-search.png)

**已安装插件与升级提示灯**

![已安装插件及升级预览旁的小灯](docs/screenshots/installed-update-light.png)

**查看可用更新**

![可更新插件列表](docs/screenshots/updates-light.png)

**GitHub 星标排序**

![按 GitHub 星标排列搜索结果](docs/screenshots/github-stars.png)

截图由实际使用界面提供，版本和查询状态以拍摄时为准。

## 许可证

[MIT](LICENSE)
