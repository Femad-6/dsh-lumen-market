# DSH STORE 隔离验收记录

验证日期：2026-10-20。环境：Windows / Node.js 24.21.0，官方 npm 包 `@deepseek-ai/dsh@0.2.1-rc.2`。仅针对 Web Profile，未调用模型或操作真实个人 Profile。

## 官方宿主的实际验收

| DSH 版本 | 安装 | 启动 | 卸载 | 故障回滚 |
| --- | --- | --- | --- | --- |
| 0.2.1-alpha.5 | unknown | unknown | unknown | unknown |
| 0.2.1-rc.1 | unknown | unknown | unknown | unknown |
| 0.2.1-rc.2 | passed | passed | passed | unknown |

最新三版本窗口来自当次官方 GitHub Releases 与 npm 核对，未将未测试版本标记为兼容。manifest 将支持目标收窄到实际通过的 `0.2.1-rc.2`；未来扩大范围必须补充验证。

执行过程：

1. 使用独立 DSH_HOME 创建 Web Profile，保存官方 `--dump-config` 基线。
2. 官方 `dsh plugin --profile web add --ignore-scripts --config.auto-install-peers=false <tgz>` 安装本地测试包。组合配置中出现 `lumen-market`。
3. 冷启动官方 Web 宿主，用临时登录 Cookie 查询 `/api/lumen-market/health`：HTTP 200，`ok=true`，`managementAvailable=true`，Profile 路径属于本次隔离目录。
4. 查询 `/api/lumen-market/installed`：HTTP 200，清单包含 `dsh-lumen-market`。
5. 停止本次宿主，由官方 CLI remove 卸载。组合配置中不再出现该 Entry ID，且与安装前基线完全一致。

原始结果的脱敏副本：[dsh-0.2.1-rc.2-windows.json](evidence/dsh-0.2.1-rc.2-windows.json)。配置、一次性 Profile 和原始日志保留在本地 `verification/`，不提交 Cookie、临时登录 URL 或个人凭据。

该结果证明插件自身在上述宿主中的安装、挂载、健康接口、清单读取和正常卸载。未验证桌面 UI、Linux/macOS、其他 DSH 版本、通过市场安装第三方插件、失败事务回滚或真实个人配置。正常卸载恢复基线不等于故障回滚。

## 静态审计与供应链

- 推荐工具：`AI-Scarlett/build-dsh-plugin`，固定 Commit `153ac8c77a492c7a69f280325b68f35004b79640`。只运行已读取的静态审计脚本，未安装该 Skill 或执行其安装脚本。
- 对项目源码快照审计：74/80，工具返回 `BLOCKED`。具体误判是将 `test/client.test.mjs:1-4` 的 Node 测试导入当作 Browser Client 导入。它没有检测到凭据日志；该工具把两种信号合并在同一错误标题中。
- 对实际测试安装包审计：无硬拦截项，静态分数 74/80，状态为 `implementation-incomplete`。安装包不含测试，所以测试存在性检查不能通过；该分数不是安全认证。源码扫描的负面结果保留，没有改名测试文件来规避扫描。
- 审计摘要：[store-static-audit.json](evidence/store-static-audit.json)。静态工具未提供自己的运行证据输入时 runtimeScore=0，与本项目另外执行的官方宿主验收分开记录。
- `npm audit --omit=dev`：0 项已知运行时漏洞。结果不覆盖未知漏洞、恶意行为或独立供应链审查；`semver@7.7.2` 仍需商城审查。详情见 [store-production-audit.json](evidence/store-production-audit.json)。
- 回归测试：147 项，146 通过、0 失败、1 项可选官方源码 parser 契约未配置而跳过。`npm run check` 检查语法、入口与兼容 manifest 状态。

## 证据身份与后续门槛

JSON 保留验收时安装包的 SHA-256，并记录 `lib/**` 和 `cordis.patch.yml` 的独立运行文件摘要；后续补充文档和逐版本状态不会被当成重新验证全部运行行为。正式提交前比较运行文件，确保与实际验收对象一致。

这些材料仅支持固定源码复检与 `user-reviewed` 审查申请。尚无独立安全审核或 DSH STORE 收录通过证据。商城复检、npm 发布与真实运行验收是不同状态；本次不覆盖或重新发布 npm 0.5.3。

## 2026-10-21 升级功能复验

升级功能的模拟管理器测试不再作为真实宿主升级证据。本次使用官方 DSH 0.2.1-rc.2，在一次性 Web Profile 中执行本地测试包的真实操作：

- 运行中的 HMR Profile 在预览阶段返回 upgrade-unavailable / HTTP 409；健康接口明确报告 profile-running。
- 停止宿主后，通过官方 CLI 将测试包从 1.0.0 升至 2.0.0；自定义配置、禁用设置及 Bundle 顺序保持不变。
- 安装要求不兼容宿主版本的 3.0.0 测试包被拒绝，官方诊断明确恢复 package.json、pnpm-lock.yaml 和 node_modules；逐字节检查配置/清单/锁文件，并确认实际安装仍为 2.0.0。
- 恢复后再次启动，健康和清单接口正常；测试包及市场包通过官方 CLI 卸载后组合配置恢复基线。

最终安装包的 SHA-256、运行文件摘要和脱敏结果见 [upgrade-2026-10-21-windows.json](evidence/upgrade-2026-10-21-windows.json)。最初一次启动未在等待窗口内就绪的失败证据保留在本地 verification，不当作通过结果；随后补充启动诊断并复验通过。

当前回归为 156 项：155 通过、0 失败、1 项可选官方源码 parser 契约未配置而跳过。另覆盖指定版本固定、预览与执行时能力改变、未知能力拒绝，以及普通升级失败不触发自动卸载。

这不代表桌面主题已实际升级，也不覆盖所有网络中断或进程崩溃恢复。按照用户选择，无法确保配置保留与旧版恢复时停止重装，保留当前可用版本。指定确切版本不等于绕过 npm 镜像同步或 pnpm 发布等待策略。

## 2026-10-21 经确认的一键卸载重装

本节更新此前“仅显示退出后升级方法”的行为：按用户明确要求，在能够保留配置和加载顺序时提供确认后的自动卸载/安装。普通升级失败仍不静默转换为卸载。

使用官方 DSH 0.2.1-rc.2、独立 Web Profile 和本机临时注册表，真实调用官方 HMR 管理器：

1. 在活动测试插件 1.0.0 上生成 reinstall 预览；缺少 reinstallConsent 的执行请求返回 HTTP 409，无卸载。
2. 确认后从已校验 target.tgz 安装 2.0.0；注册表下载计数证明安装阶段未重新下载目标包。用户 Patch、活动状态和 Bundle 顺序保持不变。
3. 安装包含不兼容宿主要求的 3.0.0 失败；自动从已校验 previous.tgz 恢复 2.0.0，配置和顺序保持。
4. 真实更新接口仍识别已校验归档的 npm 来源，并查询到 2.0.0；普通本地文件不享有该来源识别。
5. 使用官方 CLI 清理一次性 Profile 内的测试依赖，最终组合配置恢复基线。

证据：[reinstall-2026-10-21-windows.json](evidence/reinstall-2026-10-21-windows.json)。最初本地注册表遗漏 semver 元数据而失败的准备记录保留在 verification；补齐后复验通过。新实现经独立审阅修正了目标包二次下载、部分模块缺失恢复和相对 file: 路径识别问题。

回归：171 项，170 通过、0 失败、1 项可选官方源码契约跳过。界面覆盖一键升级确认页、取消不执行和显式卸载同意；事务覆盖校验失败不卸载、官方拒绝、旧版恢复、恢复失败持久阻断、不安全重定向及市场停用前后的停止/恢复。

这是活动测试插件的真实 Host 验证，不是用户主题或桌面 UI 的真实升级证明。网络/进程中断、第三方依赖丢失等情况下可能需要人工恢复；日志、旧版安装包和配置快照会保留。
