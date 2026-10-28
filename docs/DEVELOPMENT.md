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

选择 GitHub 专属排序可使用 23 个模拟仓库验证星标、最近更新、Fork 排序及翻页。预览发现页也会隐藏模拟的已安装插件。

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

搜索支持 `sort=default`（默认）、`sort=stars`、`sort=updated` 与 `sort=forks`。默认不传 GitHub API 的 sort 参数，使用最佳匹配；三个专属排序使用 `order=desc`，由 [GitHub repository search API](https://docs.github.com/en/rest/search/search#search-repositories) 对搜索结果排序。其它来源只允许 default，未知 sort 被拒绝。搜索缓存按关键词、页码和排序隔离。Star 数仅接受非负安全整数；缺失/无效时表示未知，不展示伪造的 0。

发现搜索不注入本地已安装行，并按当前 profile 的包名或 GitHub 仓库身份过滤已安装候选；客户端也隐藏 alreadyInstalled 或 installed ID 的行。来源分页仍沿用上游游标，隐藏候选可能造成当前页不足 20 个或为空，此时仍可继续翻页。安装状态下拉框已移除，「仅可安装」筛选仅作用于发现页。

安装结果保留 warnings、stage、failedAt 和 packageResult 的分类、退出状态与最多 8000 字符的输出；先对完整输出的 URL 凭据、Authorization、npm token 及常见凭据参数脱敏，再截断。市场不授权构建脚本，也不修改版本豁免。

## GitHub token

默认匿名查询。提高配额时，在启动 DSH host 的环境中明确设置 `DSH_LUMEN_MARKET_GITHUB_TOKEN`。令牌只发送到固定 GitHub API 主机，不持久化、不返回浏览器、不借用其他工具的 token。修改启动环境后，需要重启 host。

GitHub token 是凭据，不应提交到 Git、写进 Issue 或放在截图中。

## 同源 HTTP

前缀 `/api/lumen-market`，每次请求必须带 `x-dsh-lumen-market: 1`。写入仅允许回环地址。自定义头用于 CSRF 防护，不是身份鉴权；宿主本身的认证要求仍适用。

| 方法 | 路由 |
| --- | --- |
| GET | /search、/search-cache、/detail、/installed、/updates、/health、/operation?previewId=... |
| POST | /inspect、/install、/upgrade、/uninstall（仅 previewId）、/cancel（仅 operationId） |

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

## 诊断与卸载

诊断使用独立客户端状态及请求代次，关闭后取消读取并忽略迟到响应，不覆盖操作结果。面板可关闭、重开，JSON 格式化显示并限制滚动高度。

卸载权限来自 `pluginManager.listBundles()` 的 `removable` 字段，同时要求宿主提供 `removeBundle`。`/inspect` 使用 `{action:"uninstall",source:"installed",name}` 生成预览，保存当前 profile 目录、依赖名、来源、specifier 和实际版本。`/uninstall` 只接受 previewId，重新读取权限和状态，拒绝变化或过期目标；调用官方 `removeBundle(name)`，不运行自行编写的文件删除命令。卸载期间共用写操作锁，官方接口不提供卸载取消能力，因此执行阶段不显示取消操作。

执行结果保留官方失败原因；成功后刷新列表并关闭被移除目标的旧详情。内置项和不支持官方卸载接口的宿主禁用按钮。测试中的 removeBundle 为明确标注的模拟实现，真实运行时仍可能因 stop-profile、bundle-in-use 或 not-removable 拒绝卸载。

卸载卡片与已安装详情共用同一预览/确认管线。确认区在渲染后按 previewId 自动滚动到视野中央并获得焦点；失败与操作结果也自动定位，避免长列表下方点击时误以为没有响应。未安装详情不显示卸载。已安装详情返回 alreadyInstalled 和与宿主 removeBundle 能力一致的 removable，防止详情响应覆盖卡片的权限状态。

## 成功查询快照

当前 profile 的 `.lumen-market/search-cache.json` 保存版本1快照，按来源、关键词、页码和排序区分，最多80项、8MiB。先写同目录单个临时文件，再替换缓存文件；不批量删除文件。仅成功来源结果覆盖快照，失败回退对应旧快照，部分来源可更新而另一个来源保留旧数据。缓存文件经过 sanitize，不保存 Token；损坏文件被忽略，写入失败返回 cacheWarnings。

`/search-cache` 只读取快照和当前 profile，不发起远端请求；缓存元数据使用 sources[source].cached/checkedAt、stale、cacheHit。实时 `/search` 失败时可返回对应缓存并保留错误，强制刷新只清理短期来源缓存，不清理成功快照。已安装过滤与兼容性按当前 profile 重新计算，缓存不能替代安装预览查验。

客户端并行读取本地快照及实时结果，只有当前代次且实时请求尚未完成时才展示快照；成功后替换，失败保留同查询数据。关键词/来源/排序/页码不同的失败请求不会借用当前列表。浏览器 localStorage 只保存最近成功的查询控件值，数据快照保存在 host 当前 profile。离线模拟可用 `?mode=slow` 观察先展示旧列表，或成功查询后重启预览服务再用 `?mode=rate-limit` 验证磁盘恢复。

## 21项统一发现分页

`DISCOVERY_PAGE_SIZE=21` 共用于 npm 的已验证结果分页和 GitHub 的 per_page。市场按查询维护串行扫描游标，对来源结果去重、过滤当前已安装项后再取显示页，全部来源每页总共21项。直接深页和并发请求使用同一索引边界。补齐扫描受上限约束，达到上限时返回 scanLimited 提示；来源耗尽时最后一页按实际数量展示。客户端「仅可安装」仍为额外页面内筛选，可能减少可见卡片数量。

快照用 raw21/page21 前缀区分原始来源页和显示页，避免误用旧20项缓存页。宽屏无详情时采用三列，窄屏和详情旁列表响应式调整。

## 升级能力与确切版本

`updates` 的 `updateAvailable` 表示发现较新版本，`upgradeable` 还要求兼容并且宿主允许覆盖。Host 通过公开的 `ctx.get("hmr")` 判断当前官方管理器的运行中限制；能力未知时拒绝升级，不影响新安装。`health.upgrade` 返回该状态。UI 的可更新标签按新版信息过滤，不会隐藏受限项。

`inspect` 和 `execute` 的 upgrade 路径均重新检查能力，返回 `upgrade-unavailable` 和原因；不能凭旧预览绕过。确切版本通过只读 `/detail?source=npm&name=...&version=...` 查验，用户确认后仍以确切版本生成预览和执行，不跟随浮动 latest。CLI 提示只从已校验包名、确切版本和标准 profiles 目录下的安全 Profile 名称生成；自定义路径不猜测命令。

运行中受限时提供退出后升级说明，不自行修改宿主或禁用 HMR。发布等待期、镜像延迟和包管理器拒绝与运行中限制分开处理；升级失败不转换为自动卸载。只有能保留配置并可靠恢复旧版时才可另行设计经用户确认的重装事务，当前分步接口不作为该保证。

隔离验收增加 `node tools/verify-profile.mjs <固定官方CLI> <本次tgz> --upgrade`：保留一次性 Profile 和失败记录，使用本地 1.0.0/2.0.0/不兼容 3.0.0 测试包，验证运行中门禁、退出后替换、配置/禁用状态/顺序保留、官方不兼容恢复及重启。它不升级真实主题，也不证明所有网络中断或进程崩溃均可恢复。

## 经确认的一键卸载重装（2026-10-21）

本节更新上节的降级策略。`upgradeMode` 为 direct 或 reinstall；运行中无法覆盖时，如官方可卸载、目标不是市场或官方组件且能保持 Bundle 顺序，可生成 reinstall 预览。执行请求还必须带 `reinstallConsent: true`，旧页面仅发送 previewId 不会触发卸载。模式变化、Profile 变化或未完成恢复记录都会拒绝旧预览。

`Reinstaller` 仅调用官方 removeBundle/installBundle/setBundleEnabled，不自行删除插件目录、不直接重写 Profile 配置。准备阶段保存私有配置快照、校验新旧归档、重复检查文件哈希；阶段日志原子替换，终态只清理单个活动锁文件，所有归档和配置快照保留。失败后优先恢复旧版；模块文件部分缺失时仍可通过官方清理后恢复。无法恢复时返回 recovery-required 和备份位置，后续写操作失败关闭。

安装使用已经校验的本地 target.tgz，恢复使用 previous.tgz，不在卸载后重新解析浮动 registry 内容。`reinstallOrigin` 只对本 Profile 的精确事务归档（含相对 file: 路径）和终态日志保留 npm 来源；实际 source 为 tarball。`npmInstalled` 用于识别这类合法来源，普通本地/Git 来源仍不可自动升级。`--reinstall` 隔离验收使用本地测试注册表和真实官方 HMR 服务，验证确认授权、活动插件的卸载安装、配置/顺序保留、失败恢复和后续版本查询。

## 2026-10-28 兼容性与备份契约

兼容性按已验证官方宿主的优先级执行：存在 engines.dsh 时不再合并 DSH peers；缺省时检查 DSH peers，workspace 范围指向当前宿主。Node 约束和 dsh.compatibility.dsh 作者声明独立校验。宿主的确切版本豁免可作用于有效 DSH 引擎/peer 冲突，不能绕过 Node、作者附加范围或格式错误。没有 DSH 要求时 verdict=unknown/reason=undeclared；可以请求官方预检，但一键安装会停在确认页，execute 还需 compatibilityConsent=true。宿主版本未知仍不具备安装条件。

Reinstaller 在卸载前对旧版清单重新做同样判断，明确冲突且无适用豁免时返回 recovery-incompatible；原有 SHA 校验、确认同意、配置前置条件与恢复日志继续生效。

ProfileBackups 保存当前 Profile 的私有文件副本，导出只经过严格白名单投影的便携清单；复制前检查完整 dependencies 映射，完成前再次比较文件哈希。恢复仅比较并返回 readOnly=true，包含 source/target 差异。详见 [BACKUPS.md](BACKUPS.md)。
