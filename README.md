# 流明市场 · Lumen Market

<img src="https://raw.githubusercontent.com/Femad-6/dsh-lumen-market/main/assets/icon.svg" width="72" height="72" alt="流明市场图标" />

[npm 包](https://www.npmjs.com/package/dsh-lumen-market) · [GitHub 源码](https://github.com/Femad-6/dsh-lumen-market) · [问题反馈](https://github.com/Femad-6/dsh-lumen-market/issues)

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 提供一个集**插件发现、介绍、文档、安装和更新**于一体的市场。你可以搜索 npm 与 GitHub 插件，也可以查看当前已安装的本地插件。

安装和更新由 DSH 官方插件管理器执行。点击确认前，市场会展示查验过的版本或 commit，以及兼容性信息。

当前源码版本为 **0.3.1**，更新内容见 [更新记录](CHANGELOG.md)。可通过 npm `dsh-lumen-market@0.3.1`、GitHub `v0.3.1` 标签或本地目录安装。npm 安装前也可在版本页面核对发布状态。

## 实机截图

以下图片直接截取自运行中的 **DeepSeek Harness 桌面应用**，不是离线演示或设计稿。使用了自定义宿主主题；为保护隐私，仅裁去侧栏、会话列表和余额区域。截图中的版本和结果代表拍摄时的状态。

**发现插件：查看来源、简介、版本和兼容性。**

![DeepSeek Harness 中的流明市场发现页](https://raw.githubusercontent.com/Femad-6/dsh-lumen-market/main/docs/screenshots/discover.png)

**插件详情：阅读完整介绍，打开项目主页、仓库和 README。**

![DeepSeek Harness 中的流明市场插件详情](https://raw.githubusercontent.com/Femad-6/dsh-lumen-market/main/docs/screenshots/detail.png)

## 能做什么

| 功能 | 用途 |
| --- | --- |
| 搜索插件 | 搜索 npm 与 GitHub，或直接输入仓库地址 |
| 按星标排序 | 选择「GitHub 星标最多」，从高到低浏览 GitHub 候选 |
| 了解插件 | 查看简介、完整描述和文档入口 |
| 安装前查验 | 展示兼容性、确切版本或固定 commit |
| 查看已安装 | 识别 npm、本地链接、Git 等不同来源 |
| 检查更新 | 查找可更新的 npm 插件，逐项预览并原地升级 |
| 重启提醒 | 更新后持续提示需要重启的插件 |
| 安装进度与取消 | 查看查验、下载和应用阶段；支持的宿主可取消正在安装的目标 |

## 安装

使用带有官方插件管理功能的 DeepSeek Harness。插件已发布到 npm，包和仓库均包含可加载的 `lib/` 文件，无需自行构建。

### 推荐：在 DSH 中通过 npm 包名安装

1. 打开侧栏 **「插件」→「添加插件」**。
2. 填入下面的 npm 安装目标：

   ```text
   dsh-lumen-market@0.3.1
   ```

3. 确认安装，按官方管理器的提示处理构建授权或重启。
4. 安装生效后，侧栏会出现 **「流明市场」**。

需要其他版本时，可在 [npm 版本页面](https://www.npmjs.com/package/dsh-lumen-market?activeTab=versions) 确认版本号，再填写 `dsh-lumen-market@版本号`。

也可以让 DSH 使用官方管理工具完成安装：

```text
plugin_manager { action: "install_bundle", target: "dsh-lumen-market@0.3.1" }
```

### 可选：用 npm 下载到普通项目目录

需要 Node.js 22 或更高版本和 npm。在普通项目目录运行：

```sh
npm install dsh-lumen-market@0.3.1 --ignore-scripts --registry=https://registry.npmjs.org
```

这会将包下载到当前项目的 `node_modules/dsh-lumen-market`，不会自动在 DSH 中激活。要在 DSH 中使用，推荐通过上面的官方插件管理器安装；不要直接在 DSH 的 profile 目录执行 npm 安装。

### 从 GitHub 安装 0.3.1

在 DSH 官方「添加插件」中填写：

```text
github:Femad-6/dsh-lumen-market#v0.3.1
```

此示例使用本次版本标签。需要完整 commit SHA 时，可在 [GitHub 提交列表](https://github.com/Femad-6/dsh-lumen-market/commits/main/) 复制对应提交的完整 SHA，并替换末尾的 `v0.3.1`。流明市场内的 GitHub 安装预览仍会将仓库查验结果固定到完整 SHA。GitHub 来源不会获得 npm 来源的按包名更新按钮。

### 从本地目录安装

适合希望修改代码或本地测试的用户。需要 Git、Node.js 22 或更高版本，以及 npm。

```sh
git clone https://github.com/Femad-6/dsh-lumen-market.git
cd dsh-lumen-market
npm ci --omit=dev --ignore-scripts --no-audit --no-fund
```

然后在 DSH「添加插件」中输入克隆目录的**绝对路径**。例如，克隆目录是 `C:\Plugins\dsh-lumen-market`，就填写该路径。请替换为你自己的实际目录。

本地安装通常会建立 link/junction。安装后不要移动目录；修改 host 代码后，需要正常退出并重新打开 DSH。

## 开始使用

1. **找插件**：进入「发现」，输入关键词、`owner/repo` 或 GitHub 仓库根地址，选择来源后点击「搜索」。
2. **看介绍**：点击「查看详情」，阅读描述与兼容性，使用「查看文档」了解更多。
3. **装插件**：目标符合条件时，点击「安装预览」，核对版本或 commit，再点击「确认安装」。
4. **查更新**：进入「已安装」或「可更新」，点击「重新检查」。有更新时，逐项预览和确认。

「已安装」会先显示本地列表，再在后台查询更新。三个标签页的「重新检查」都会请求新数据；发现页的筛选条件不会影响已安装列表。输入完整 npm 包名时，市场优先直接查询该包，减少关键词搜索漏收录的影响。

发现页的「排序」可以选择 **「GitHub 星标最多」**，会自动切换到 GitHub 来源并回到第一页。仓库按星标数从高到低排列，翻页和重新检查会保持排序；卡片与详情展示取得的 GitHub 星标数。切换到 npm 或全部来源时恢复默认排序，星标排序仍遵守页面提示的 GitHub 搜索范围。

星标数当前只显示在 GitHub 来源结果中；npm、本地链接和已安装项尚未补查关联仓库的星标数，因此这些卡片不显示 star。

宽屏下，右侧详情会随列表滚动保持可见，点击列表下方的插件无需返回页面顶部。长详情可在面板内独立滚动，切换插件后从新详情顶部开始阅读；窄屏则在列表上方展示详情并自动定位。

安装期间会显示官方管理器报告的阶段。出现「取消操作」时可以发起取消；市场会等待安装进程结束和文件恢复后的最终结果。已经进入应用阶段时可能无法取消。安装失败时可展开「安装诊断」，查看失败分类、已脱敏的输出及待授权的构建提示。

只检查或浏览不会自动安装、更新插件。待重启提示在刷新页面后仍会保留，真正重启 DSH 后才清空。

## 搜索来源

| 来源 | 搜索范围 |
| --- | --- |
| npm | 宿主配置的注册表；默认使用 npm 官方源，并带 npmmirror 回退 |
| GitHub | 关键词搜索限定 `dsh-plugin` topic，按最近更新排序；直接输入仓库根地址可查验没有这个 topic 的仓库 |
| 全部来源 | 合并 npm 与 GitHub，并在第一页显示匹配的本地已安装插件 |

GitHub 搜索不是全仓库扫描。搜索结果只是候选，需要打开详情完成查验，才可能提供安装按钮。

npm 分页按查验后的候选显示，每页最多 20 项。为控制等待时间，每次最多扫描 3 页原始候选；达到上限会明确提示缩小关键词，不把原始搜索数量当成已验证插件总数。

## 常见问题

**为什么搜不到某个插件？**

检查来源和筛选条件。找本地安装的插件时，选择「全部来源」并关闭「仅可安装」，或者进入「已安装」。找 GitHub 项目时，包名可能与仓库名不同；直接输入完整仓库地址更准确。网络失败、限流或注册表尚未收录也会影响结果。

**为什么显示“未验证”，没有安装按钮？**

首版只直接安装仓库根目录的单包插件。缺少 DSH 声明、缺少构建产物、导出路径无法完整查验或不兼容时，会显示原因。只有客户端模块、monorepo 子包和无法固定 commit 的目标也不会直接安装。静态查验不能保证插件运行成功，最终结果仍由官方管理器决定。

**为什么本地链接和 Git 插件没有升级按钮？**

按 npm 包名升级会替换原来的安装来源，因此只对符合条件的 npm 依赖提供更新。本地 link/file、Git、压缩包和 npm 别名不会被转换成注册表安装，也不会自动追踪新的 Git commit。

**安装或更新失败怎么办？**

查看页面错误和官方管理器的诊断。兼容性拒绝会说明不满足的 peer 范围；构建脚本授权也由官方处理。市场不会自动授权脚本、写入兼容性豁免或重试安装。若提示 profile 定位异常，可点击页面底部「诊断」查看原因；分享诊断前请检查路径等个人信息。

**GitHub 限流怎么办？**

等待页面显示的重试时间。匿名查询可用；需要提高配额时，可以在启动宿主的环境中设置专用变量 `DSH_LUMEN_MARKET_GITHUB_TOKEN`，具体说明见开发文档。不要将 token 放进仓库或截图。

## 开发与反馈

开发命令、接口和验证说明见 [开发文档](https://github.com/Femad-6/dsh-lumen-market/blob/main/docs/DEVELOPMENT.md) 与 [验证摘要](https://github.com/Femad-6/dsh-lumen-market/blob/main/docs/VALIDATION.md)。隔离集成测试使用真实临时 profile 文件和 HTTP，但安装器是模拟实现；真实桌面升级与回滚仍按 [实机验收步骤](docs/MANUAL-ACCEPTANCE.md) 单独检查。离线预览使用模拟 API，实机截图来自桌面应用。

遇到问题可提交 [Issue](https://github.com/Femad-6/dsh-lumen-market/issues)，附上 DSH 版本、操作步骤和去除敏感信息后的截图。

## 许可证

MIT。第三方依赖说明见 [THIRD_PARTY_NOTICES.md](https://github.com/Femad-6/dsh-lumen-market/blob/main/THIRD_PARTY_NOTICES.md)。
