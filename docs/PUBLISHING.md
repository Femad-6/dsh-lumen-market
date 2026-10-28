# 发布流程

当前发布目标为 `dsh-lumen-market@0.6.0`。以 npm 官方源的实际版本、latest 标签和安装包校验结果判断是否已经发布；已发布版本不能覆盖。

```powershell
npm test
npm run check
npm pack --ignore-scripts
npm login --registry=https://registry.npmjs.org --auth-type=web
npm publish .\dsh-lumen-market-0.6.0.tgz --registry=https://registry.npmjs.org --access public --tag latest --ignore-scripts
npm view dsh-lumen-market@0.6.0 version dist.integrity --registry=https://registry.npmjs.org
npm view dsh-lumen-market dist-tags --json --registry=https://registry.npmjs.org
```

发布前核对 Git 分支与远端，提交本次源码、图标、测试及文档并推送固定版本标签。发布的是检查过的 tgz，不在发布时执行生命周期脚本。登录和发布可能各自要求浏览器授权；不要把 Token 或验证码写入仓库。

如果 npm 提示正在处理，先等待并查询注册表，不重复发布同一版本。发布后确认 latest，并比对下载包的 SHA-512 与本地已验证包。镜像与市场目录可能另有同步延迟。GitHub CI、npm 接收、公开可下载和真实宿主验收分别记录。
