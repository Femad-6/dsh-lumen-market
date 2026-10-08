# 开发与诊断

## 本地开发

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run preview
node tools/smoke.mjs
npm pack --dry-run
```

`preview` 在 `http://127.0.0.1:19408` 提供离线演示：使用真实客户端和 React，API、插件数据与安装结果均为模拟内容，不连接桌面 profile。它不能作为真实安装证据。关闭启动终端即可停止。

`smoke` 只读查询公开 npm/GitHub API，不执行安装。网络可达性随环境变化。

## 结构

- `lib/index.js`：Cordis host 装配。
- `lib/host/`：profile、npm、GitHub、兼容性、市场协调和路由。
- `lib/client.js`：通过 DSH classic module loader 装载的客户端。
- `assets/icon.svg`：官方插件列表图标。
- `test/`：离线逻辑、真实 HTTP、官方契约及 React 测试。

本插件不注册模型工具，也不注入系统提示词。生产依赖只有 semver；React/jsdom/esbuild 用于开发验证。

## 搜索与安装边界

搜索缓存 5 分钟，清单缓存 15 分钟，最多 500 条；查验 ID 有效 10 分钟、最多 200 条、单次使用。缓存只在 host 内存中。

GitHub 单次查验最多 12 请求，并发 3，每个请求超时 10 秒。清单最大 512 KiB，搜索响应最大 4 MiB。固定完整 SHA 后检查 package.json、patch 和必要入口文件，不执行仓库代码。

执行端只接受 host 创建的 previewId，重新校验目标及当前来源后调用官方 installBundle。npm 固定确切版本；GitHub 固定完整 commit。刷新客户端不会清空 host 的 pendingRestart。

## GitHub token

默认匿名查询。提高配额时，在启动 DSH host 的环境中明确设置 `DSH_LUMEN_MARKET_GITHUB_TOKEN`。令牌只发送到固定 GitHub API 主机，不持久化、不返回浏览器、不借用其他工具的 token。修改启动环境后，需要重启 host。

GitHub token 是凭据，不应提交到 Git、写进 Issue 或放在截图中。

## 同源 HTTP

前缀 `/api/lumen-market`，每次请求必须带 `x-dsh-lumen-market: 1`。写入仅允许回环地址。自定义头用于 CSRF 防护，不是身份鉴权；宿主本身的认证要求仍适用。

| 方法 | 路由 |
| --- | --- |
| GET | /search、/detail、/installed、/updates、/health |
| POST | /inspect、/install、/upgrade |

页面底部「诊断」是推荐的排查入口。直接访问 host 时，请使用实际端口和合法认证会话；不要为排查关闭宿主认证。

## 测试与截图

`npm test` 包含本机临时 HTTP 端口测试。沙箱 EACCES 与产品错误应分别处理。`test/official-contract.test.mjs` 使用本机官方源码路径；没有该目录时会明确跳过该项。

`docs/screenshots/` 保存经过隐私裁切的真实 DeepSeek Harness 桌面截图。完整原图、机器日志和诊断数据保留在 Git 忽略的 `verification/` 中。公开截图只裁切私人侧栏区域，不替换界面文字或数据。

浏览器 HMR 是否热替换客户端由 profile 决定；host 修改需要重启。真实升级、回滚、脚本授权仍应由使用者在实际宿主中验收。
