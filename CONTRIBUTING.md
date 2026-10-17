# 提交纪律（本仓库）

## 这个仓库是什么

`dsh-skill-picker` 的个人 fork。**不在 npm 发布**，靠「包名不同 + 未发布」实现
永不升级覆盖。工作区只是 Git 版本管理点；真正被 DSH 加载的副本在
`E:\dsh-home\profiles\desktop\node_modules\dsh-skill-catalog\`。

## 铁律：node_modules 才是运行真相，本仓库是它的版本备份

改完 `node_modules\dsh-skill-catalog\` 里的任何文件，**必须同步回本仓库并提交**，
否则下次重装插件就把改动丢了。反过来也一样：改了本仓库要手动拷回
node_modules 才生效（没有构建链，见下）。

## 同步命令

```powershell
# node_modules → 本仓库（改完插件后）
robocopy "E:\dsh-home\profiles\desktop\node_modules\dsh-skill-catalog" `
         "E:\agent work\skill管理插件" /E /NFL /NDL /NJH /NJS /NP /XF "*.bak-*"

# 本仓库 → node_modules（重装插件后）
robocopy "E:\agent work\skill管理插件" `
         "E:\dsh-home\profiles\desktop\node_modules\dsh-skill-catalog" /E /NFL /NDL /NJH /NJS /NP
```

## 关于构建

`package.json` 里保留了 `"build": "node build.mjs"`，但 **`build.mjs` 已被上游裁掉、
`esbuild` 也没装**。所以：

- `src/` 是**可读的真相源**（改这里最安全）；
- `lib/` 是**真正被加载的产物**（改这里才生效）；
- 两边改完必须保持一致。改 `lib/` 时同步改 `src/`，反之记录清楚。

## 提交粒度

一次改一件事，message 写清「改了什么 + 为什么」。历史版本记录沿用上游 README
里的 changelog 段，新增条目写 `v1.x.y`，不要改动 `v0.x` 的既有内容。
