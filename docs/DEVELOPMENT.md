# 开发与诊断

## 本地开发

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run check
npm run preview
node tools/smoke.mjs
npm pack --dry-run
```

`preview` 在 `http://127.0.0.1:19408` 提供离线演示：使用真实客户端和 React，API、插件数据与安装结果均为模拟内容，不连接桌面 profile。它不能作为真实安装证据。关闭启动终端即可停止。

选择「GitHub 星标最多」可使用 23 个模拟仓库验证排序、翻页和星标显示。

访问 `http://127.0.0.1:19408/?layout=long` 可验证 20 个模拟插件的长列表和长详情。宽屏详情使用 sticky 定位、容器高度上限和独立滚动；ResizeObserver 根据页面与底部栏尺寸更新高度，卸载时清理。窄屏回到内联详情，选择插件后只滚动市场自身容器，不滚动其它宿主面板。

`smoke` 只读查询公开 npm/GitHub API，不执行安装。网络可达性随环境变化。

## 结构

- `lib/index.js`：Cordis host 装配。
- `lib/host/`：profile、npm、GitHub、兼容性、市场协调和路由。
- `lib/client.js`：通过 DSH classic module loader 装载的客户端。
- `assets/icon.svg`：官方插件列表图标。
- `test/`：离线逻辑、真实 HTTP、官方契约及 React 测试。

本插件不注册模型工具，也不注入系统提示词。生产依赖只有 semver；React/jsdom/esbuild 用于开发验证。

## 搜索与安装边界

搜索缓存 5 分钟，保留最多 32 个查询会话；清单缓存 15 分钟，最多 500 条。注册表配置缓存 30 秒、最多 1 条，并发请求共用同一次读取，避免一页候选反复启动宿主的 pnpm 配置查询。查验 ID 有效 10 分钟、最多 200 条、单次使用。缓存只在 host 内存中。

npm 完整包名优先读取清单；包不存在或不是插件时再做关键词搜索。每次最多扫描 3 页原始候选，每个查询最多扫描 500 个原始候选，筛选后的公开页最多 20 项。返回 `hasMore`、`scanned`、`scanLimited` 与 `totalExact`，不会把 npm 原始总数当成插件总数。上游空页或短页与报告总数不一致时返回 `incomplete:true`，不宣称总数确定。同一查询的并发翻页串行扫描，防止游标重复。

`/installed` 只读取当前 profile，本地数据可立即展示；客户端随后请求 `/updates` 补齐更新状态。强制重新检查使用 `/search?force=1` 或 `/updates?force=1`，清除相应缓存并重新读取注册表配置。后台响应、详情及安装预览按请求代次隔离，导航后忽略旧响应。

GitHub 单次查验最多 12 请求，并发 3，每个请求超时 10 秒。清单最大 512 KiB，搜索响应最大 4 MiB。固定完整 SHA 后检查 package.json、patch 和必要入口文件，不执行仓库代码。

执行端只接受 host 创建的 previewId，重新校验目标及当前来源后调用官方 installBundle。npm 固定确切版本；GitHub 固定完整 commit。刷新客户端不会清空 host 的 pendingRestart。

`plugin-manager/install-state` 事件按本次 requestId 匹配，仅投影阶段与注册表尝试信息，不转发任意宿主日志。客户端每 500 毫秒轮询绑定自身 previewId 的操作；结束或卸载时停止轮询。取消端接受服务器生成的 operationId，查验阶段取消会阻止安装开始，安装阶段委托官方 cancelInstall。`too-late` 不能解释为取消成功；最终文件恢复和 application 仍由官方管理器确认。

GitHub 搜索支持 `sort=updated`（默认）与 `sort=stars`，固定 `order=desc`，由 [GitHub repository search API](https://docs.github.com/en/rest/search/search#search-repositories) 在搜索结果上排序。`/search?source=github&sort=stars` 是合法调用；其它来源搭配 stars 或未知 sort 会被拒绝。搜索缓存按关键词、页码和排序隔离。Star 数仅接受非负安全整数；缺失/无效时表示未知，不展示伪造的 0。

安装结果保留 warnings、stage、failedAt 和 packageResult 的分类、退出状态与最多 8000 字符的输出；先对完整输出的 URL 凭据、Authorization、npm token 及常见凭据参数脱敏，再截断。市场不授权构建脚本，也不修改版本豁免。

## GitHub token

默认匿名查询。提高配额时，在启动 DSH host 的环境中明确设置 `DSH_LUMEN_MARKET_GITHUB_TOKEN`。令牌只发送到固定 GitHub API 主机，不持久化、不返回浏览器、不借用其他工具的 token。修改启动环境后，需要重启 host。

GitHub token 是凭据，不应提交到 Git、写进 Issue 或放在截图中。

## 同源 HTTP

前缀 `/api/lumen-market`，每次请求必须带 `x-dsh-lumen-market: 1`。写入仅允许回环地址。自定义头用于 CSRF 防护，不是身份鉴权；宿主本身的认证要求仍适用。

| 方法 | 路由 |
| --- | --- |
| GET | /search、/detail、/installed、/updates、/health、/operation?previewId=... |
| POST | /inspect、/install、/upgrade、/cancel（仅 operationId） |

页面底部「诊断」是推荐的排查入口。直接访问 host 时，请使用实际端口和合法认证会话；不要为排查关闭宿主认证。

## 测试与截图

`npm test` 包含本机临时 HTTP 端口测试。沙箱 EACCES 与产品错误应分别处理。`test/official-contract.test.mjs` 通过 `DSH_PLUGIN_MANAGER_SOURCE` 指定官方 `install-spec.ts`。未设置时明确跳过；设置了无效路径时测试失败，避免误报契约已验证。例如 PowerShell：

```powershell
$env:DSH_PLUGIN_MANAGER_SOURCE='D:/Deepseek Harness/packages/boot/plugin-manager/src/install-spec.ts'
npm test
```

CI 在 Linux/Windows、Node 22/24 上执行语法与包入口检查、测试和打包预检。CI 不会安装到桌面宿主；可选官方源码契约测试默认跳过。

`test/integration.test.mjs` 组合真实 Profile、npm 适配器、路由和临时文件，验证升级后版本、禁用状态、bundles 顺序以及失败/取消后的读取。修改与恢复由模拟管理器完成，不能据此声称真实官方升级或回滚已经验收。临时夹具保留，不执行批量清理。

`docs/screenshots/` 保存经过隐私裁切的真实 DeepSeek Harness 桌面截图。完整原图、机器日志和诊断数据保留在 Git 忽略的 `verification/` 中。公开截图只裁切私人侧栏区域，不替换界面文字或数据。

浏览器 HMR 是否热替换客户端由 profile 决定；host 修改需要重启。真实升级、回滚、脚本授权仍应由使用者在实际宿主中验收。
