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
