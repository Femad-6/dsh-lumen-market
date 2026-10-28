# DSH STORE 审核说明

本文件回应 Catalog blocked 通知，供固定 Commit 的人工审查使用。项目建议采用 `user-reviewed` 更新策略；作者声明不代表商城批准或独立安全审计通过。源码中的文件、网络和凭据信号是实际能力，不通过重命名、混淆或删除说明来规避检查。

## 安装契约与兼容范围

- 包名 `dsh-lumen-market`，MIT；Host 入口 `lib/index.js`，Client 入口 `lib/client.js`。
- Bundle Patch 为 `cordis.patch.yml`，只插入插件自己的 `lumen-market` Entry ID，不替换或禁用官方组件。
- Node.js：`^22.19.0 || >=24.0.0`。DSH 目标版本及逐版本验证状态以 `package.json` 中 `dsh.compatibility` 为准；版本范围是支持目标，`unknown` 不表示已经通过。
- 需要官方 `webServer` 服务；插件管理能力通过宿主公开 `pluginManager` 服务提供。服务缺失时不自行调用包管理器替代。
- 原生 JavaScript，无构建要求，无 `preinstall`、`install`、`postinstall`、`prepare` 安装脚本。
- 最新源码的兼容元数据以 GitHub 默认分支固定 Commit 为准；本次修正不会覆盖此前已经发布的 npm 安装包。

## 依赖与供应链

唯一直接运行时依赖是 **semver 7.7.2 / ISC**，用于版本范围比较；确切版本、下载地址和 integrity 保存在 `package-lock.json`。它没有传递运行时依赖。React、ReactDOM、jsdom、esbuild 仅用于开发测试；浏览器运行时使用宿主提供的 React，不下载远程脚本。完整署名见 [THIRD_PARTY_NOTICES](../THIRD_PARTY_NOTICES.md)。

安装其他插件时，官方管理器可能下载其依赖并处理构建脚本。这属于被安装目标的独立供应链风险；本插件的审核不替代对目标的审查，不能保证第三方插件安全。

## 实际权限与数据边界

| 能力 | 范围和用途 | 约束 |
| --- | --- | --- |
| 文件读取 | 读取当前 Profile 的 package.json、已安装依赖清单，识别来源和版本 | 不遍历用户文档，不修改 DSH 核心、官方包或凭据文件 |
| 文件写入 | 当前 Profile 的 `.lumen-market/search-cache.json`、`install-cache.json` 及同目录临时文件 | 每个缓存最多 80 项、8 MiB；原子替换；不包含 Token；损坏缓存忽略、写入失败可见 |
| 浏览器存储 | 保存界面查询状态 | 不保存登录凭据 |
| 网络 | 查询 npm 元数据、GitHub 搜索、固定 SHA 的清单与文件树、Star 历史 | 请求超时、响应大小和并发有界；GitHub 请求固定到 `api.github.com`；元数据不跟随重定向。安装归档最多跟随 3 次受限重定向，不带凭据、不降低 HTTPS，最终核对 SHA-512 |
| 凭据 | 可选环境变量 `DSH_LUMEN_MARKET_GITHUB_TOKEN` | 仅用于 GitHub API Authorization，不落盘、不传给浏览器；不借用 gh、npm 或其他插件的登录凭据 |
| 插件安装、更新、卸载 | 用户操作经预览校验后调用官方 `installBundle`、`removeBundle` | 固定 npm 版本或 GitHub commit，预览一次性消费，检查 Profile/来源/版本变化及并发；宿主拒绝必须保留 |
| 命令执行 | 发布包的 `lib/` 不直接调用 shell 或子进程 | 官方管理器可能启动包管理器；仓库验收工具启动官方 DSH CLI，工具不随插件发布 |

默认 npm 查询源为 `registry.npmjs.org` 和 `registry.npmmirror.com`；如宿主提供 registry/fallbackRegistries，则使用其配置，可能访问自定义 HTTP 或 HTTPS 注册表。搜索词、包名、仓库名会发送到相应外部服务。目标包与依赖下载的主机、脚本执行规则由官方管理器控制。插件不提供遥测，不发起模型调用。

## 接口、失败与生命周期

Host 注册 `/api/lumen-market` 前缀，依赖宿主认证。每个请求还要求 `x-dsh-lumen-market` 头；写操作只允许回环地址。该头是 CSRF 防护，不替代身份鉴权；反向代理部署应保留宿主认证和网络访问控制。

- 网络故障、超时或限流可回退到已查验的固定安装目标，并显示缓存时间；仍需要网络下载安装包。无效清单、不存在目标、兼容性冲突与官方拒绝不使用旧缓存绕过。
- 缺少官方插件管理服务时停止变更；运行中的 Profile 不支持升级时显示宿主限制，不直接编辑依赖以绕过。
- 单次包变更及脚本授权由官方管理器负责。确认重装时，市场额外保存安装包、配置快照和持久阶段日志，以进程内互斥、Profile 活动记录、变更前哈希和分阶段状态检查防止旧预览或并发变更继续卸载。恢复未完成时阻止后续变更。不能将分步调用当成宿主原子事务；进程崩溃后的自动恢复尚未验收。
- 停用时通过 `ctx.effect` 释放路由、进度订阅、待处理请求和预览；Client 通过宿主生命周期释放界面。
- 安装其他插件的真实效果、失败回滚、桌面 UI 和完整多版本矩阵，必须与本插件自身的安装/启动/卸载验证分开评价。

## 可复验的隔离验收

```powershell
npm test
npm run check
New-Item -ItemType Directory -Path verification -Force
npm pack --ignore-scripts --pack-destination verification
node tools/verify-profile.mjs <固定官方DSH的lib/bin.js绝对路径> <本次tgz绝对路径>
```

验收工具创建独立 DSH_HOME、DSH_AGENTS_HOME、npm 配置与缓存，移除继承环境中的凭据；仅通过官方 CLI 安装/卸载测试包。启动后使用内存中的临时登录 Cookie 查询真实插件健康接口和已安装清单；不保存登录 URL 或 Cookie。所有 Profile、配置和脱敏结果留在 Git 忽略的 `verification/`，不批量删除，不操作用户现有 Profile。

结果与限制记录在 [STORE-VALIDATION](STORE-VALIDATION.md)。`dump-config`、静态审计、真实 Host HTTP、桌面 UI、商城收录是不同层级的证据，不能互相替代。

## 已确认的卸载重装

只有 Profile 自有、官方允许卸载的 npm 插件可进入重装；市场自身与官方命名空间受到保护。受当前公共接口限制，已选 Bundle 只有位于列表末尾时才能在移除并重新加入后保持原有顺序；其他目标在卸载前停止，不调整其他插件。

卸载前将新版和旧版恢复归档核对 SHA-512，单包上限 64 MiB、下载限时 30 秒；并将 package.json、锁文件、用户 Patch、根配置和 workspace 配置快照保存在 `.lumen-market/reinstall/<事务ID>/files/`。原配置不直接改写。只有 Profile 状态仍与快照一致才调用官方 removeBundle；成功后用已验证的 target.tgz 调用 installBundle。

安装失败时使用 previous.tgz 恢复旧版；这两种归档均长期保留。实际来源如实显示为 npm 固定安装包；只有本市场完成/已恢复的事务、确切归档路径和版本能关联 npm 来源，普通本地文件不能伪装成 npm 插件。配置快照可能含有私有设置，只在本机保存，不提交或返回其内容。尚未完成的事务通过活动记录阻止再次变更，需先核查备份并恢复；不会删除目录或无条件覆盖用户后续修改。

恢复归档覆盖插件本体，不保证第三方依赖缓存始终可用。依赖不可获取、宿主拒绝或进程崩溃仍可能需要人工恢复；这类情况保留 recovery-required 记录与配置快照，不继续卸载其他插件。

## 2026-10-28 配置备份与兼容提示

配置备份接口只在用户点击后复制当前 Profile 的固定配置文件，快照位于 `.lumen-market/backups/`，可能包含私有设置，因此仅留在本机。导出只返回经白名单校验的插件清单，不含配置正文、凭据、机器路径或配置文件内容哈希；恢复接口只计算差异，不执行安装、删除或写回。所有备份接口要求回环地址、自定义头，有 Origin 时必须同源；输入、文件大小与插件数量均有边界。详见 [BACKUPS.md](BACKUPS.md)。

兼容性以声明检查而非真实加载结论呈现：有效 engines.dsh 优先于 DSH peers，缺少 DSH 声明显示 unknown 并要求再次确认；Node 或作者附加范围冲突、畸形元数据仍拒绝。只有官方确切版本授权能豁免其适用的 DSH 范围，不将授权扩展到其他约束。卸载前另外检查旧版恢复要求，避免移除后才发现无法恢复。
