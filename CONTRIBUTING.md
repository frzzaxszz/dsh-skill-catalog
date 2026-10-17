# 提交纪律（本仓库）

## 这个仓库是什么

`dsh-skill-picker` 的个人 fork。**不在 npm 发布**，靠「包名不同 + 未发布」实现
永不升级覆盖。工作区只是 Git 版本管理点；真正被 DSH 加载的副本在
`E:\dsh-home\profiles\desktop\node_modules\dsh-skill-catalog\`。

## 铁律：本仓库 `plugin/` 是 Git 真相源，另两份从它同步

改完本仓库 `plugin/` 里的任何文件，**必须同步到另两份**，否则下次 `pnpm install`
就会把改动冲掉：

| 副本 | 角色 |
| --- | --- |
| `plugin/`（本仓库） | Git 真相源，**先改这里** |
| `E:\dsh-home\profiles\desktop\local-plugins\dsh-skill-catalog\` | `file:` 依赖指向的源，pnpm install 时覆盖 node_modules |
| `E:\dsh-home\profiles\desktop\node_modules\dsh-skill-catalog\` | DSH 实际加载的 |

profile 里本插件的依赖写成 `file:local-plugins/dsh-skill-catalog`，
`dsh-plugin-update` 因此判 `source-install` → 永不升级（比单纯改名更强）。

本机 `nodeLinker: hoisted`，pnpm 对 `file:` 依赖做的是**复制**而非硬链接
（已用 `fsutil hardlink list` 验证两份是独立 inode），所以只改 `node_modules`
那份真的会被冲掉。

## 同步命令

### 标准流程（改了 `plugin/`）

推给 `local-plugins`（pnpm 的真相源），再让 pnpm 传播到 `node_modules`：

```powershell
robocopy "E:\agent work\skill管理插件\plugin" `
         "E:\dsh-home\profiles\desktop\local-plugins\dsh-skill-catalog" /E /NFL /NDL /NJH /NJS /NP /XF "*.bak-*"
node "E:\dsh-home\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.cjs" install --dir "E:\dsh-home\profiles\desktop"
```

想立刻生效不想跑 pnpm，就直接再推一份到 `node_modules`（但下次 install 仍会以
`local-plugins` 为准，所以那份必须已经同步过）：

```powershell
robocopy "E:\agent work\skill管理插件\plugin" `
         "E:\dsh-home\profiles\desktop\node_modules\dsh-skill-catalog" /E /NFL /NDL /NJH /NJS /NP
```

> pnpm 不在 PATH。用 DSH 自带的
> `E:\dsh-home\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.cjs`（v11.7.0）。
> corepack 那份 12.8.1 模块缺失会报 MODULE_NOT_FOUND。

### 反向（在 local-plugins 上直接热改过）

拉回仓库并提交，否则下次 clone 丢失：

```powershell
robocopy "E:\dsh-home\profiles\desktop\local-plugins\dsh-skill-catalog" `
         "E:\agent work\skill管理插件\plugin" /E /NFL /NDL /NJH /NJS /NP /XF "*.bak-*"
```

> **踩过的坑**：曾只改 `node_modules`，`local-plugins` 那份停在 58 键旧版，
> 下次 install 就被覆盖回去。改完三份都要核对映射表键数一致。

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
