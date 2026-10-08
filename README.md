# 流明市场 · dsh-lumen-market

<img src="assets/icon.svg" width="80" height="80" alt="流明市场图标" />

一个独立的 DeepSeek Harness 插件市场：搜索 npm 和 GitHub 插件，阅读简短介绍、打开文档，经过目标查验和预览后，通过官方管理器安装或原地更新。

官方插件列表使用 `assets/icon.svg` 专属光灯图标；通过 package.json 顶层 icon 声明，随包发布。

## 安装

GitHub 仓库：<https://github.com/Femad-6/dsh-lumen-market>。仓库提交了可直接加载的 `lib/` 文件，无需构建。

在支持仓库查验的市场中粘贴上述地址，确认后可安装固定 commit 的版本。也可以在 DSH 官方「插件」页填写 `github:Femad-6/dsh-lumen-market#<完整commit SHA>`；将占位符替换为 GitHub 上要安装的提交。

从源码本地开发：

```sh
git clone https://github.com/Femad-6/dsh-lumen-market.git
cd dsh-lumen-market
npm ci --ignore-scripts --no-audit --no-fund
```

在 DSH 侧栏「插件」中，用以下**绝对路径**添加：

```text
D:\dsh-plugins\dsh-lumen-market
```

或者由 DSH 的官方工具执行：

```text
plugin_manager { action: "install_bundle", target: "D:\\dsh-plugins\\dsh-lumen-market" }
```

本地路径通常成为 link/junction；不要移动已安装目录。上面的路径是 Windows 开发目录示例，请替换为你自己的克隆目录。该仓库已包含 host/client 产物，Node >=22，生产依赖只有 semver。克隆到另一台机器后，先在目录运行 `npm install --omit=dev --ignore-scripts`。host 改动需要重启 DSH，client 是否热替换取决于当前 profile 的 HMR。安装后的管理结果才是是否需要重启的依据。

侧栏显示「流明市场」。现有市场和更新中心可以保留；本插件不依赖它们，也不自动停用或卸载它们。

## 使用

- **发现**：输入插件关键词，选择 npm、GitHub 或全部来源，点击搜索；筛选可安装或已安装状态。「全部来源」的第一页也包含当前 profile 中匹配的已安装插件，本地 link 插件可查看简介和文档，不提供注册表替换安装。
- **仓库直达**：选择 GitHub，输入 `owner/repo` 或完整仓库根地址。可以查看没有 DSH topic 的仓库。
- **查看详情**：列表显示两行简介；详情显示完整描述、版本、来源、兼容性及 README/主页/源码/npm 链接。介绍来自作者元数据；缺失时明确提示。
- **安装**：详情查验通过后，点击「安装预览」，审阅确切版本或 commit，再「确认安装」。GitHub 搜索候选并不等于可安装插件。
- **已安装**：显示实际来源和磁盘版本，检查最新版；失败与未知版本不当作已是最新。
- **可更新**：仅列出符合条件的 npm 更新，逐项预览并升级。保留禁用状态，不先卸载、不改变已有启用包顺序。查询失败另有提示。

更新成功后，待重启提示由 host 保留；刷新浏览器不会清空，真正重启 DSH 后清空。官方返回的构建脚本待授权、兼容性拒绝和失败诊断分别显示；本插件不会自动授权脚本或新增版本豁免。

## GitHub 搜索范围与限制

关键词使用 GitHub repository search，限定 `topic:dsh-plugin`，按最近更新排序。它不是全 GitHub 扫描。精确仓库地址绕过 topic 限制。每页 20 项，公开 GitHub 搜索最多覆盖 1000 项。

npm 搜索使用官方管理器解析出的注册表配置，默认 npm 官方源及 npmmirror 回退。它与本地 profile 搜索是不同来源：仅选择 npm 或 GitHub 时，不包含本地目录。找本地 dsh-moonpet 时选择「全部来源」，关闭「仅可安装」，搜索 moonpet；或直接进入「已安装」。其仓库元数据指向 `https://github.com/Femad-6/deepseek-moonpet`，仓库名称与 npm 包名并不相同。

打开详情才读取默认分支 commit，固定完整 SHA，检查根 package.json、bundle patch、入口及相对 exports 文件。只支持根目录单包插件。缺少编译文件、危险/通配符导出路径、无法完整查验、仅客户端包或不兼容目标不会提供安装按钮。静态文件检查不能保证运行成功；官方管理器负责最终安装与运行时预检。

安装 spec 为 `github:owner/repo#<40位SHA>`；npm spec 为 `<包名>@<确切版本>`。本地 link/file、Git、tarball 和 npm 别名不提供按包名更新按钮，也不追踪已安装 Git 依赖的新 commit。

匿名 GitHub 可用；限流时显示重试时间并停止请求，不循环重试。如需要提高配额，可在启动 host 的环境里明确设置 `DSH_LUMEN_MARKET_GITHUB_TOKEN`。仅发送到固定 GitHub API 主机，token 不持久化、不返回浏览器、不读取其它工具的 token。

搜索/清单缓存为进程内存，分别 5/15 分钟，最多 500 条；查验 ID 有效 10 分钟、最多 200 条且只能执行一次。GitHub 单次查验最多 12 请求，并发 3，每请求 10 秒；响应与 body 有大小上限。重启不留下缓存文件。

## HTTP 与排查

前缀 `/api/lumen-market`，每次请求必须带 `x-dsh-lumen-market: 1`。写入仅允许回环地址；自定义头是 CSRF 防护，并非身份鉴权。没有远程写入开关。

```powershell
Invoke-RestMethod 'http://127.0.0.1:19387/api/lumen-market/health' -Headers @{ 'x-dsh-lumen-market' = '1' }
```

面板「诊断」显示 host 进程、profile 定位及管理服务状态。找不到 profile 时回报被否掉的候选。端口取决于实际 DSH 启动配置；以上是当前桌面使用过的地址示例。浏览器 HTTP/JS 错误与 host 安装结果需分别排查。

GET：`/search`、`/detail`、`/installed`、`/updates`、`/health`。POST：`/inspect`、`/install`、`/upgrade`。执行端只接受 host 的 previewId；不接受客户端任意安装命令或 URL。

## 开发与验证

```powershell
npm install --ignore-scripts --no-audit --no-fund
npm test
npm run preview
node tools/smoke.mjs
npm pack --dry-run
```

`preview` 在 `http://127.0.0.1:19408` 提供离线演示：真实 React 与本插件真实客户端，API 和安装结果均为模拟数据，不连接桌面 profile。关闭启动终端即可停止。开发机的 `verification/` 是本地验证记录目录，不上传到 GitHub；测试与预览不进入 npm 发布文件。

测试覆盖来源保护、兼容性完整 semver、缓存、GitHub SHA/文件/限流、安装预览、操作串行化、禁用状态保留、来源变更、失败判定、真实 HTTP、双语及真实 React 点击。官方 parser 契约测试仅在本机 `D:/Deepseek Harness` 源码存在时运行，其他机器会明确跳过。

公开验证摘要见 [docs/VALIDATION.md](docs/VALIDATION.md)。本地完整日志和截图保留在开发机。离线测试和预览不能替代真实 DSH 加载及安装验收；本插件已收到本地安装后的界面反馈，但没有通过自动化执行真实插件升级或失败回滚验收。

## 文件结构

`lib/index.js` 装配 Cordis；`lib/host/` 包含 profile、npm、GitHub、兼容性、协调与路由；`lib/client.js` 通过 DSH classic module loader 装载。没有工具注册，也没有注入系统提示词。

## License

MIT。第三方依赖归属见 THIRD_PARTY_NOTICES.md。
