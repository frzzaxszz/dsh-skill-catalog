# 提交纪律（本仓库）

## 这个仓库是什么

`dsh-skill-picker` 的个人 fork。**不在 npm 发布**，靠「包名不同 + 未发布」实现
永不升级覆盖。工作区只是 Git 版本管理点；真正被 DSH 加载的副本在
`E:\dsh-home\profiles\desktop\node_modules\dsh-skill-catalog\`。

## 铁律：node_modules 才是运行真相，本仓库是它的版本备份

改完 `node_modules\dsh-skill-catalog\` 里的任何文件，**必须同步回本仓库并提交**，
否则下次重装插件就把改动丢了。反过来也一样：改了本仓库要手动拷回
node_modules 才生效（没有构建链，见下）。

## 仓库结构

```
plugin/     ← 插件本体，node_modules\dsh-skill-catalog\ 的版本备份（提交这个）
backup/     ← 本地回退用，不进仓库
docs/       ← deck 插件的后端选择
```

## 同步命令

改完 `node_modules\dsh-skill-catalog\` 后同步回 `plugin/`：

```powershell
robocopy "E:\dsh-home\profiles\desktop\node_modules\dsh-skill-catalog" `
         "E:\agent work\skill管理插件\plugin" /E /NFL /NDL /NJH /NJS /NP /XF "*.bak-*"
```

重装插件后从 `plugin/` 还原：

```powershell
robocopy "E:\agent work\skill管理插件\plugin" `
         "E:\dsh-home\profiles\desktop\node_modules\dsh-skill-catalog" /E /NFL /NDL /NJH /NJS /NP
```

## 关于构建

`package.json` 里保留了 `"build": "node build.mjs"`，但 **`build.mjs` 已被上游裁掉、
`esbuild` 也没装**。所以：

- `src/` 是**可读的真相源**（改这里最安全）；
- `lib/` 是**真正被加载的产物**（改这里才生效）；
- 两边改完必须保持一致。改 `lib/` 时同步改 `src/`，反之记录清楚。

## 配套技能：sync-catalog-zh-descriptions

维护中文备注映射表的技能，住在 `C:\Users\29736\.agents\skills\sync-catalog-zh-descriptions\SKILL.md`
（**不在本仓库内**）。它规定了：取数路径、磁盘优先的合并逻辑、中文判据、
翻译口径、内联进 `lib/client.js` 的手法、以及验证步骤。改映射表前先读它。

该技能原名 `sync-picker-zh-descriptions`，2026-10-17 随 fork 一起改名
（frontmatter `name` 与目录名都改了）。旧名在 DSH 的技能目录里已不存在。

## 提交粒度

一次改一件事，message 写清「改了什么 + 为什么」。历史版本记录沿用上游 README
里的 changelog 段，新增条目写 `v1.x.y`，不要改动 `v0.x` 的既有内容。
