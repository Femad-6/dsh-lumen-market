# 发布 dsh-lumen-market 0.5.1 到 npm

0.5.1 已发布到 npm。下方保留发布流程供后续版本参考；npm 发布和 GitHub 标签是两个独立步骤。

## 已准备

- package.json、package-lock.json、GitHub 请求 User-Agent、README 和 CHANGELOG 同步为 0.5.1。
- 本次版本包含发现仅展示未安装插件、21项分页、来源排序、可关闭诊断与操作结果、官方卸载及持久化发现缓存。
- `lib/` 是可直接加载的 JavaScript，不需要额外构建。

## 在 PowerShell 上传

先进入项目，登录你有此包发布权限的 npm 账号：

```powershell
Set-Location 'D:\dsh-plugins\dsh-lumen-market'
npm login --registry=https://registry.npmjs.org --auth-type=web
npm whoami --registry=https://registry.npmjs.org
```

按浏览器提示完成登录。使用自己有 `dsh-lumen-market` 发布权限的账号；根据 npm 提示完成双因素验证。

如果之后修改过源码或文档，先重新测试、检查和打包：

```powershell
npm test
npm run check
npm pack --ignore-scripts
```

然后上传已核验的发布包：

```powershell
npm publish .\dsh-lumen-market-0.5.1.tgz --registry=https://registry.npmjs.org --access public --tag latest
```

预期结束时显示 `+ dsh-lumen-market@0.5.1`。如果 npm 要求验证码，按提示输入；需要显式 OTP 时，可在上面的命令末尾追加 `--otp=当前验证码`。不要将 npm Token 写入项目文件或提交到 Git。

## 发布后核对

```powershell
npm view dsh-lumen-market@0.5.1 version --registry=https://registry.npmjs.org
npm view dsh-lumen-market dist-tags --json --registry=https://registry.npmjs.org
```

确切版本应为 `0.5.1`，`latest` 应指向 `0.5.1`。版本页面：[npm versions](https://www.npmjs.com/package/dsh-lumen-market?activeTab=versions)。

上传不会提交 Git，也不会创建 GitHub `v0.5.1` 标签。GitHub 标签安装示例只有在相应标签创建并推送后才可用；本次没有自动执行这些步骤。

如果提示 `EPUBLISHCONFLICT`，说明该版本已经存在，不能覆盖；先核对注册表。若提示 `E403` 或认证错误，检查账号发布权限及双因素验证，不要把网络失败当作发布成功。

命令依据为当前机器 npm CLI 的 publish/login 帮助及随 npm 安装的官方文档；在线参考：[npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish)、[npm login](https://docs.npmjs.com/cli/v11/commands/npm-login)。

0.5.1发布后GitHub README已精简为插件介绍。npm该版本的README属于发布时的包内容，不因GitHub提交而改变；后续版本发布时再携带新README。
