---
name: sync-catalog-zh-descriptions
description: 把 dsh-skill-catalog 的技能备注统一成中文并给新技能分配分类。新技能接入时自动扫描全量技能，缺中文备注的补上、已有中文的跳过；没进分类表的分配一个分类写进 CATEGORY_MAP（8 类：工程/排错/需求/设计/文档/调研/技能/自动化）。面板里残留的英文备注（含磁盘优先导致同名被 shadow 的情况）一并收敛。仅手动触发。
---

# 同步 dsh-skill-catalog 中文备注与技能分类

让 ⚡ 技能面板显示的所有备注都是中文，并让每个技能都落在正确的分类 chip 里。
**只手动触发**——用户说「同步中文备注」「面板还有英文」「补一下技能备注」
「给新技能分类」「新装了个技能，跑一下这个」时执行，不要自动跑。

一次执行做两件事，缺一件都算没做完：

1. **备注汉化**：映射表里没有中文的技能补一条中文备注（第 1–4 步）。
2. **自动分类**：分类表里没有分类的技能分配一个分类，写进 `CATEGORY_MAP`（第 5 步）。

两件事都要落到 `src/` 与 `lib/` 两份真相源（第 6 步），一起验证（第 7 步），
最后让用户重启（第 8 步）。

## 背景：为什么需要这个技能

`dsh-skill-catalog` 的 ⚡ 面板有两条取数路径：

- **主路径**：官方 `skills.list` RPC（`ctx.remote.skills` / `connection.api.skills`）。
- **备胎路径**：`/dsh-skill-catalog/skills` 磁盘扫描，只读 4 个文件系统根
  （`~/.agents/skills`、`$DSH_HOME/skills`、`<cwd>/.agents/skills`、`<cwd>/.dsh/skills`）。

这台机器上主路径取不到（内核侧 RPC 不可用），面板一直走备胎。而备胎
**结构上看不见** `bundled`（DSH 与插件自带）、`custom`（配置的额外根）、
`runtime`（插件运行时注册）三类——占全量 65 个中的 54 个。

已有的三处优化（本技能负责维护它们，不要重复造）：

1. `plugin/src/client/zh-descriptions.js` —— `name → 中文备注` 映射表 +
   `zhDescription(skill)`：表里有就用中文，没有就原样回落英文 description。
2. `plugin/src/client/categories.js` —— `name → 分类短名` 映射表
   （`CATEGORIES` / `CATEGORY_MAP` / `categoryOf` / `categoriesPresent`）：
   表里没有的技能落空串，面板上并进「全部」，不单独成 chip。
3. `plugin/lib/client.js` 里的 `fetchRegistrySkills(cwdQuery)` —— 从
   `/api/dsh-skill-explorer/list` 拉宿主注册表，与磁盘扫描按名字合并，
   **磁盘优先**（用户装的技能 shadow bundled 同名技能）。

前两张表都是**纯显示层字典**：一张表、随时可改、可整体撤掉，
不进 `package.json`、不改变任何技能的加载或路由。

**重要：`description` 是喂给模型的。** 所以中文备注只改显示层，绝不写回
`SKILL.md`——改文件会同时改变模型的技能路由判断。分类同理，也只写进
`categories.js`：`category` 不是官方 frontmatter 字段，写进 60+ 个技能换不来
任何宿主行为，只是把维护成本摊到每个文件上。

> **fork 之后「升级会覆盖」这个前提已经消失。** `dsh-skill-catalog` 是
> `dsh-skill-picker@0.5.28` 的个人 fork，未发布 npm，上游升级再也覆盖不到它。
> 本机还进一步用 `file:local-plugins/dsh-skill-catalog` 依赖把它钉死——
> `dsh-plugin-update` 的 `registrySpec` 谓词判 `sourceInstall=true`、
> `blockedReason=source-install`，即永不升级（已用 `createUpdateReader` 实测证实，
> 比单纯改名更强）。但改动仍然**必须同步回 Git 仓库**，否则下次重装插件会丢
> ——见「收尾」。

## 执行前必读：三份副本，别只改一份

这个插件有**三份**副本，缺一份就会在下次 install 时被冲掉：

| 副本 | 角色 |
| --- | --- |
| `E:\agent work\skill管理插件\plugin\` | Git 真相源，**先改这里** |
| `E:\dsh-home\profiles\desktop\local-plugins\dsh-skill-catalog\` | `file:` 依赖的真相源，pnpm install 时用它覆盖 node_modules |
| `E:\dsh-home\profiles\desktop\node_modules\dsh-skill-catalog\` | DSH 实际加载的 |

**最省事的做法：只改仓库 `plugin/`，再同步到另两份。**

```powershell
# 1. 仓库 → local-plugins（pnpm 的真相源）
robocopy "E:\agent work\skill管理插件\plugin" `
         "E:\dsh-home\profiles\desktop\local-plugins\dsh-skill-catalog" /E /NFL /NDL /NJH /NJS /NP /XF "*.bak-*"

# 2. 让 pnpm 传播到 node_modules（pnpm 不在 PATH，用 DSH 自带那份）
node "E:\dsh-home\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.cjs" install --dir "E:\dsh-home\profiles\desktop"
```

想跳过 pnpm 立刻生效，就直接再推一份到 `node_modules`（但 `local-plugins`
必须已同步，否则下次 install 又被覆盖）：

```powershell
robocopy "E:\agent work\skill管理插件\plugin" `
         "E:\dsh-home\profiles\desktop\node_modules\dsh-skill-catalog" /E /NFL /NDL /NJH /NJS /NP
```

反过来，若是在 `local-plugins` 上直接热改的，先拉回仓库再提交：

```powershell
robocopy "E:\dsh-home\profiles\desktop\local-plugins\dsh-skill-catalog" `
         "E:\agent work\skill管理插件\plugin" /E /NFL /NDL /NJH /NJS /NP /XF "*.bak-*"
```

> **踩过的坑**：曾只改 `node_modules`，`local-plugins` 那份停在 58 键的旧版，
> 下次 `pnpm install` 就被覆盖回去。本机 `nodeLinker: hoisted`，pnpm 对
> `file:` 依赖做**复制**而非硬链接（已用 `fsutil hardlink list` 验证是独立 inode），
> 所以只改 `node_modules` 真的会丢。**改完必须核对三份的映射表键数一致。**

## 执行步骤

### 第 1 步：取全量技能

```powershell
$node = 'D:\DeepSeek Harness\resources\runtime\primary-runtime\dependencies\node\bin\node.exe'
$d = Invoke-WebRequest 'http://127.0.0.1:19387/dsh-skill-catalog/skills' -TimeoutSec 12
$r = Invoke-WebRequest 'http://127.0.0.1:19387/api/dsh-skill-explorer/list' -TimeoutSec 15
```

- `/dsh-skill-catalog/skills` = 磁盘扫描（磁盘优先，面板实际显示它）。
- `/api/dsh-skill-explorer/list` = 宿主注册表全量，按 `groups[].key` 分
  `bundled` / `custom` / `project-dsh` / `project-agents` / `user-dsh` /
  `user-agents` / `runtime` / `other:<source>`。

两个都可能 401 或空——**explorer 路由无需鉴权**，若它挂了就先解决它，
没有注册表就无法知道 bundled/custom/runtime 有哪些。

### 第 2 步：算出面板真正显示的列表

复刻合并逻辑（**磁盘优先**，这是关键，别搞反）：

```
shown = 磁盘扫描全部
for 注册表每项:
    if 名字不在 shown: shown.push(注册表项)
```

同名时磁盘赢。所以 bundled 的 `writing-for-agents` 会被
`~/.agents/skills/writing-for-agents` 覆盖——**要补的是磁盘那份的中文**，
补 bundled 那条没用，面板上看不见。

### 第 3 步：找出缺中文的

一条备注算「有中文」的判据：**存在连续 4 字以上的中文短语** `/[\u4e00-\u9fff]{4,}/`。

> **不要用「含 CJK 字符」或「CJK 占比」当判据**，两个都栽过：
> 「含 CJK」分不出「英文为主 + 末尾挂一句中文」的混合备注
> （`dsh-chat-import-convert` 的 CJK 占比只有 0.11，就是这样被漏掉的）；
> 「CJK 占比 < 0.35」又会误报——专名密集的中文（`DSL`、`Admin API`、
> `/to-spec`、`interchange v1` 这些必须保留原文）比值天然低，
> `dify-workflow`、`implement-spec` 都曾被误判成要补。
> 「连续 4 字中文短语」不受专名密度影响，是唯一同时不漏不误的判据。

对 `shown` 每一项检查，分出三桶：

- **A. 映射表里已有中文** → 跳过。
- **B. 映射表缺失，但该技能自己的 description 已含成句中文** → 不用管
  （`zhDescription()` 会回落拿到中文原文）。
- **C. 映射表缺失且 description 没有成句中文** → **要补**。
  混合备注（英文为主 + 末尾挂一句中文）也落在这桶。

只处理 C。把 C 的名单和英文原文打印给用户看，再动手翻译。

分类的缺口是**另一套判据**：不看语言，只看 `CATEGORY_MAP` 里有没有这个键
（见第 5 步）。两套判据互不包含——description 已经是中文的技能照样可能没分类，
所以两张表都要各自扫一遍。

### 第 4 步：补中文备注

编辑**仓库副本**的 `plugin\src\client\zh-descriptions.js`
（`E:\agent work\skill管理插件\plugin\src\client\zh-descriptions.js`）：

- 加在 `ZH_DESCRIPTIONS` 里，按现有分组注释归档
  （bundled: mattpocock 工程技能 / 诊断浏览器 Office Univer；custom: superpowers；
  用户自装技能另起一段；混合备注修正另起一段）。
- 键名必须是官方技能名（小写连字符）。
  唯一例外：`$DSH_HOME/skills/self-improving` 的 frontmatter `name` 是
  `Self-Improving + Proactive Agent`（带空格和加号），原样写，别规范化——
  规范化了就等于没这条备注。它和 `$DSH_HOME/skills/self-improving-agent`
  那条 `self-improvement` 是两个技能，两条都要有。
- **不要**给映射表里已有的键换译文，除非用户明确要求。
- 长度跟随现有条目：一两句话说清「什么时候用、干什么」，别整段翻译
  英文原文的每个从句。

翻译口径（照现有条目）：

- 保留专有名词原文：`SKILL.md`、`Univer`、`Base Unit`、`Board`、`Sheet`、
  `ADR`、`GLOSSARY.md`、`tracer-bullet`、`PR`、`/to-spec` 这类技能名与文件名。
- 技能名引用写成 `/技能名`（如 `/to-spec`），因为面板点一下插入的就是这个手势。
- 技术动词用中文：扫、拆、落地、复盘、追问、分诊、灰度。
- 别加映射表里没有的夸张语气，保持平实。

### 第 5 步：分配分类

编辑**仓库副本**的 `plugin\src\client\categories.js`
（`E:\agent work\skill管理插件\plugin\src\client\categories.js`），
把第 3 步 C 桶里那些技能、以及任何没进 `CATEGORY_MAP` 的技能，各补一条分类。

#### 短名只有 8 个

严格等于 `CATEGORIES` 里的 `key`，一个字都不能改：

| 短名 | 全名 | 范围 |
| --- | --- | --- |
| `工程` | 工程开发 | 写码、实现、评审、计划、分支收尾 |
| `排错` | 诊断排错 | Bug、性能回归、会话复盘、沙箱 ACL |
| `需求` | 需求打磨 | 追问、规格、工单、分诊、原型 |
| `设计` | 前端设计 | 界面、动效、文案语气 |
| `文档` | 文档办公 | Word / Excel / PPT / Univer |
| `调研` | 调研写作 | 调研、教学、交接、导入、笔记 |
| `技能` | 技能管理 | 写技能、用技能、自我改进 |
| `自动化` | 自动化 | 浏览器、桌面、Dify 工作流 |

**分类是「按用途」不是「按来源」。** 判断依据只有一个：
用户**什么时候**会想用它。它从哪装来（bundled / custom / 用户自装、
mattpocock / superpowers / 自写）与分类无关；同一个来源里既有排错技能也有需求技能。

#### 判据

看这个技能**产出什么**、**什么时机被用**，命中一条就够：

- 产出或修改代码、评审代码、拆实现计划、收尾分支 → `工程`
- 只有出了问题才用、本身是一条诊断流程（Bug、性能、会话复盘、环境拒绝）→ `排错`
- 动手之前用：追问、问清需求、写规格、拆工单、分诊、做原型 → `需求`
- 产出视觉产物：界面、设计方向对比、动效、文案语气 → `设计`
- 产出 Office / Univer 文件（docx、xlsx、pptx、.univer 各 Unit）→ `文档`
- 读资料、写文档、做调研、教学、交接、导入对话记录、整理笔记 → `调研`
- 管技能本身：写技能、用技能、自我改进、本技能 → `技能`
- 操作浏览器 / 桌面 / 外部服务（Dify、向导脚本）→ `自动化`

几个容易站错位的：

- **写文档 ≠ 文档。** `文档` 是产出 Office 文件那一批；写 Markdown、
  调研报告、交接文档算 `调研`（现有表里 `research`、`handoff` 就是这么归的）。
- **`pr` 归 `调研` 不归 `工程`。** 它只产出 PR 正文，不改代码。
- **`prototype` 归 `需求` 不归 `工程`。** 原型是用来回答「该不该这么做」的，
  用完即弃，不是交付物。
- **`wizard` 归 `自动化`。** 它生成的是替人跑流程的脚本。

#### 拿不准时

- 边界模糊、两边都像 → **宁可归 `工程`**，不要新建第 9 个分类。
  这与面板的老原则一致：**误归一类代价远小于丢一个技能**。
- 真的哪一类都不像（不是这几件事里的任何一种）→ **就不写进表**。
  留空 = 未分类，面板上并进「全部」，技能照样看得见、点得到，不会丢。
- 想新增分类名，只有用户明确要求时才做。自造的名字会让 `CATEGORIES`
  与 `CATEGORY_MAP` 脱节（表外的名会排到 chip 行最后、用原名显示），别顺手加。

#### 写进表里

- 键必须是**官方技能名**（小写连字符，与界面里 `/技能名` 手势一致，
  也就是第 2 步算出来的 `name`），不是目录名。
- **有一个特例不要规范化**：`$DSH_HOME/skills/self-improving` 的 frontmatter
  `name` 是 `Self-Improving + Proactive Agent`（带空格和加号），
  必须原样当键写，写成 `self-improving-proactive-agent` 就等于没分类。
  注意 `$DSH_HOME/skills/self-improving-agent` 那条的 name 是 `self-improvement`，
  两条并存，各写各的。
- 按现有的分组注释归档到对应段落（`// ── 工程` / `// ── 排错` / …），
  别在文件末尾另起一堆；同组内大致按字母序插进去。
- 只加不换。表里已有的键**不要**重排、改译、改分类，除非用户明确要求。

#### 已分类的不要重复分

`CATEGORY_MAP` 里已有的键直接跳过，不要每次跑都重新权衡一遍。

- 已经分了类的技能，即使你个人觉得该换一类，也**保持原样**——
  分类是用户的视觉习惯，重排会让 chip 里的技能跳来跳去。
- 要改分类是**另一种请求**：用户明确说「这个技能分类不对」「把 X 挪到 Y」时才动，
  动完在报告里单独说明挪了哪几个、从哪到哪。
- 所以这个技能是**纯增量**的：每次跑的结果应当是「新增 N 条分类」，
  而不是「全表重排」。

### 第 6 步：同步到编译产物

`package.json` 的 `exports` 指向 `./lib/client.js`，**GUI 加载的是编译产物**。
而安装包里 `build.mjs` 被裁掉了、`esbuild` 也没装（devDependencies 未安装），
无法重新打包，所以必须把两张表都内联进 `lib/client.js`。

**`src/` 与 `lib/` 是双份真相源，两边都要改。**
`src/client/zh-descriptions.js` 有对应拷贝，`src/client/categories.js` 同样有——
**`categories.js` 也是双份真相源的一部分，只改 `src` 不内联 `lib`，面板上不会有任何变化。**

用 Node 脚本做（**先备份**）：

```javascript
// 读 src/client/zh-descriptions.js 与 src/client/categories.js，
// 各自剥掉 import/export，内联进 lib/client.js 的 factory 作用域，
// 插在 isUserFacingSkill 之后。两个模块都要做，做法完全一致。
function inlineModule(pathToSrc) {
  const src = readFileSync(pathToSrc, 'utf8')
  return src
    .replace(/^import .*$/gm, '')
    .replace(/^export const /gm, 'const ')
    .replace(/^export function /gm, 'function ')
    .trim()
}
```

该文件是 esbuild IIFE 产物（`window.__ModuleLoader__.load({ id, factory })`），
**没有 import/export 语句**，所以在同一 factory 作用域内内联追加是安全的。

幂等：每次替换前先查目标串是否已存在。

```powershell
# 内联前先确认 lib 里到底有没有这两张表：两个都该是 1 以上
Select-String -Path '<lib/client.js>' -Pattern 'ZH_DESCRIPTIONS' -Encoding utf8 | Measure-Object
Select-String -Path '<lib/client.js>' -Pattern 'CATEGORY_MAP'    -Encoding utf8 | Measure-Object
```

`CATEGORY_MAP` 命中数为 0 就说明 `categories.js` 从没内联过，面板上不会有 chip
——别以为它已经在跑。**当前状态（2026-10-18 v1.1.0 之后）已经是 1 以上**，
两个都命中才正常；从 0 变 1 是首次内联，1 保持不变才是幂等。

编译产物里中文串是 `\uXXXX` **字面量**形态（源码字符，不是已解码 Unicode）。
匹配时用 `String.fromCharCode(92) + 'u' + '672C'` 这种拼法，别直接写中文字面量——
PowerShell 传参和文件读取都会啃掉反斜杠。
> 两种形态在 `lib/client.js` 里并存（`zh-descriptions` 内联进来的那段是**真中文字符**，
> 原有的 UI 文案仍是 `\uXXXX` 转义），别因为看到一处中文就断定整份都是解码后的。

备份命名：`lib/client.js.bak-zh-<YYYYMMDD>`（分类也走同一个备份，不必另存一份）。

> **顺手扫一遍 ASCII 标识符。** 上一轮 fork 改名时，正则只匹配 ASCII，
> 漏掉了 `lib/index.js` 里两处：`SKILL_CATALOG_GUIDANCE` 的中文文案
> （「技能选择器」没改成「技能面板」）和 section 名 `plugin:skill-picker`。
> 改完编译产物后 `grep -r "skill-picker\|SKILL_PICKER" lib/` 扫残留，
> **中文文案要按 `\uXXXX` 转义序列拼目标串来比对**，正则扫不到。

> **内联是追加，不是替换。** 内联 `categories.js` 时若 `lib/client.js` 里
> 已经存在同名标识符，`new Function` 会直接抛重定义错误——所以幂等检查
> 必须针对 `CATEGORY_MAP` 这个标识符本身，而不是随便找一段中文。

### 第 7 步：验证

```powershell
& $node --check '<src/client/zh-descriptions.js>'
& $node --check '<src/client/categories.js>'
& $node --check '<lib/client.js>'
```

再用 Node 跑一遍第 2、3 步的合并与语言判据，确认：

- `中文条数 === shown.length`（全中文化达成）。
- 无重复键。
- `zhDescription({name:'xxx'})` 对表外名字回落英文，不返回空。

分类单独验三条：

- `CATEGORY_MAP` 里没有拼错的短名——值必须严格是那 8 个之一，
  表外短名会以「排到 chip 行最后、显示原名」的形式出现，肉眼很容易漏。
- 新加的键能对上第 2 步 `shown` 里的 `name`（拼错的键等于没分类，且不报错）。
- `categoriesPresent(shown)` 出的 chip 没有空分类——某个 chip 点进去
  一个技能都没有，比没有这个 chip 更糟。

`new Function(code)` 包一下 `lib/client.js` 确认语法没坏。

### 第 8 步：告知用户重启

改的是 `lib/client.js`，**必须重启 DSH 才生效**。明确告诉用户这一点，
并说明备份在哪、怎么回退。

> **别在重启前判断「没改成功」。** DSH 只在启动时把 `lib/client.js` 读进内存，
> 之后改文件对运行中的进程完全无感。曾出现过「改完了面板还是英文」的误判——
> 实际是 `lib/client.js` 的 `LastWriteTime` 晚于 DSH 进程 `StartTime`，
> 旧代码还在内存里跑。验证顺序：**先 `node --check` 过语法 → 确认文件
> `LastWriteTime` → 再让用户重启 → 重启后才看效果**。
>
> 判断当前加载的是新是旧，可看 DSH 进程启动时间与文件修改时间的先后：
> ```powershell
> Get-Item "<lib/client.js>" | Select-Object LastWriteTime
> Get-Process -Name "DeepSeek Harness" | Select-Object Id,StartTime
> ```

## 收尾

1. 同步回 Git 仓库并提交（命令见「执行前必读」）。写的是 `src/` 与 `lib/` 两份，
   提交时两份一起进。
2. 报告，备注与分类分开说：
   - 备注：补了几个、是哪几个、总条数从多少到多少。
   - 分类：新增了哪几个技能、各归哪一类、`CATEGORY_MAP` 从多少条到多少条；
     若有技能判定为「哪类都不像」而留空，列出名字并说明为什么留空。
   - 备份路径、提醒重启。

若备注全部已有中文、分类也全部已归档，直接说「无需补充」，不要为了改而改。

## 已知的坑

- **先确认用户看的是哪个面板，别默认是自己的。** 本机输入框旁有**两个** ⚡ 按钮：
  左侧 `dsh-skill-market`（技能市场，槽位 `conversation.input.left`，标题「⚡ 技能」，
  placeholder「搜索技能...」，读注册表原文、**无中文映射逻辑**，功能是逛市场装/卸远程技能）；
  右侧才是本插件的 ⚡ 面板（槽位 `conversation.input.right`，标题
  「选择技能（插入 /技能名 到发送框）」）。用户说「⚡ 面板还有英文」时，
  **先核对标题文案**再动手，否则会诊断错对象。
- **主路径是坏的，别去修它。** `remote.skills` 取不到的原因在 `app.asar`
  里读不到，无法诊断。维护备胎 + 注册表合并是当前唯一可行路线。
- **asar 读不了。** `D:\DeepSeek Harness\resources\app.asar` 的 header 是
  Chromium ValueSerializer pickle，不是标准 asar；PowerShell 无法枚举，
  Node 手动解析也失败。别在这上面花时间。
- **内置浏览器起不来。** `browser provider(s) electron are registered but
  report themselves unavailable`。要在浏览器里验证就请用户自己看 GUI，
  或走 web server 路由（explorer 的 `/api/dsh-skill-explorer/*` 无需鉴权）。
- **explorer 路由与 catalog 路由都无需鉴权。** `/dsh-skill-catalog/*` 直接可读，
  `/api/dsh-skill-explorer/*` 也可读，但 DSH web server 根路由 `/` 和 `/api`
  会 401——别用根路由判断插件是否活着。
- **`/dsh-skill-catalog/client` 会返回 skills JSON，不是 client.js。**
  host 半边用 `register({ kind: 'prefix' })` 注册，通配匹配吃掉了 `/client`
  子路径。别用它判断浏览器半边是否加载。
- **`trae-cn` 来源是用户故意停用的**（`$DSH_HOME/skills-manager/state.json`
  里 `"trae-cn": false`）。**不要**去打开它。残留的 `agent-browser` 会以
  `other:agent-trae-cn` 分组出现，照常补中文即可。
- **重名按 rank 决胜**：`project-dsh(100) > project-agents(200) > runtime(250)
  > custom(300) > user-dsh(400) > user-agents(500) > bundled(600)`。
  磁盘优先的合并顺序与这个 rank 一致。
- **`categoryOf()` 有两条来源，两条都已通着。** 它优先读技能自己声明的
  `skill.category`（frontmatter 的 `category:`），其次才查 `CATEGORY_MAP`。
  host 的磁盘扫描会把这个字段带出来（v1.1.0 起 `src/index.js` /
  `lib/index.js` 的 `scanSkillsDirInto` 里加了 `category`，缺省不带）。
  所以自己给 SKILL.md 写 `category: 工程` 是生效的，且**盖过**表里的值——
  遇到「表里改了却不生效」，先去看那个技能的 frontmatter 是不是自己写了
  `category:`。注意官方路径（`remote.skills` 与 explorer 注册表）都不带
  这个字段，所以**只有磁盘扫描来源**的技能能自带分类。
- **分类表的键要跟 `zh-descriptions.js` 的键同形。** 两张表喂的是同一个
  `skill.name`，所以在其中一张里拼错，另一张通常也是错的一起错；核对时
  拿它们互相校验最省事：`ZH_DESCRIPTIONS` 有、`CATEGORY_MAP` 也有的键，
  两边拼法应当完全一致（`Self-Improving + Proactive Agent` 这个怪名字两边都原样）。
- **`CATEGORIES` 与 `CATEGORY_MAP` 的一致性只看值。** 值的取值域就是
  `CATEGORIES` 的 8 个 `key`；对不上的值不会报错，只会让那个 chip
  排到行末并显示原名。改表后拿 `CATEGORIES.map(c => c.key)` 做一次集合校验，
  比肉眼扫 60 多行可靠。
