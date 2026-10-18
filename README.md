# dsh-skill-catalog

> **DSH Web GUI 的技能面板**——点一下 ⚡，全部技能带中文备注与分类排在你面前，搜索、筛类、点选、插入，随消息发出自动加载。

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/frzzaxszz/dsh-skill-catalog/blob/main/plugin/LICENSE)
[![DSH](https://img.shields.io/badge/DSH-%E2%89%A50.1.1--rc.1-4cc9f0)](https://github.com/deepseek-ai/deepseek-harness)
[![npm](https://img.shields.io/badge/npm-not%20published-lightgrey)](#安装)

---

## 解决什么问题

DSH 官方内置了 `/` 技能补全，但它是**记忆驱动**的：你得先记得技能名，打 `/` + 前缀才能过滤出来。装了几十个技能之后，谁也记不住。

本插件在输入框旁加一个 ⚡ 按钮，点开就是全部技能：

- **全量发现**——磁盘扫描与宿主注册表合并，连 `bundled` / `custom` / `runtime` 三类结构上看不见的技能也列得出来
- **8 类分类**——工程 / 排错 / 需求 / 设计 / 文档 / 调研 / 技能 / 自动化，点 chip 只看该分类
- **中文备注**——只影响显示层，不改任何 `SKILL.md`，模型的技能路由判断完全不受影响
- **拼音搜索**——`ji yi` / `jiyi` / `jy` 都能搜到中文技能
- **智能排序**——置顶 → 最近使用 → 常用 → 其余，再按「自动 / 手动」区分模型能否自行调用
- **技能管理**——右键置顶 / 关闭 / 定位 / 卸载（移入备份，可撤回）
- **跨端共享**——桌面端与网页端的置顶、使用记录共用一份

选中后把官方 `/技能名` 手势插进发送框，随消息发出，由 DSH 原生机制加载技能——**零 agent 侧改动**。

**记得名字用官方 `/`，忘了名字用 ⚡，两者互补，可同时使用。**

## 安装

本插件**不发布到 npm**，从 GitHub 装：

```sh
dsh plugin --profile web add "git+https://github.com/frzzaxszz/dsh-skill-catalog.git#path:/plugin"
```

> ⚠️ **`#path:/plugin` 不能省。** 这个仓库是「插件在子目录」的布局：根目录放仓库说明，
> 真正的 `package.json` 与 `cordis.patch.yml` 在 `plugin/` 里。少了这一段，pnpm 在仓库
> 根找不到 `package.json`，安装会失败。

固定到某个 commit：

```sh
dsh plugin --profile web add "git+https://github.com/frzzaxszz/dsh-skill-catalog.git#path:/plugin&commit=<sha>"
```

重启 `dsh web`（或刷新页面）即生效。

> 国内 HTTPS 受限时改用 SSH（同样要带 `#path:/plugin`）：
> `dsh plugin --profile web add "git+ssh://git@github.com/frzzaxszz/dsh-skill-catalog.git#path:/plugin"`
> 或先执行 `git config --global url."git@github.com:".insteadOf "https://github.com/"`

## 自带技能

装插件会**一并装上**它自己的维护技能，不需要另外手放到 `~/.agents/skills`：

| 技能 | 什么时候用 |
| --- | --- |
| `sync-catalog-zh-descriptions` | 新装了技能、面板上还有英文备注、或新技能没落进分类 chip 时，调它一次，**同时**补中文备注与分配分类 |

因为 DSH 读技能的四个根（`~/.agents/skills`、`$DSH_HOME/skills`、`<cwd>/.agents/skills`、`<cwd>/.dsh/skills`）都不包含 `node_modules`，光把文件塞包里没人读得到——所以 host 半边启动时向 `skills` 服务注册了一个 provider（rank 350），机制与 `dsh-mattpocock-skills-deck` 的随包技能一致。

优先级：项目级（100/200）> 随包（350）> 你自己装在 `~/.agents/skills` 的同名副本（500）。**同名的以你那份为准**——用户的选择优先。

### 为什么这件事要「调用一个 skill」，而不是全自动

装了插件之后，新技能应该一进来就自动被翻译、自动归类——这是更理想的形态，本插件也确实**能做到**：host 侧用 `ctx.on('agent/pre-step', ({ agent }) => …)` 拿到活 agent，再 `agent.followup(msg)` 把任务塞进会话，模型自己就去做，不需要任何外部 API。同机的 `meow-memory` 就是这么把记忆整理做成全自动的。

**但我们仍然设计成由你显式调用**，理由有三个，都不是技术限制：

**① 自动化要往你正在跑的会话里插话。** `followup`/`steer` 不排队、不弹窗，表现为对话里凭空多出一次助手动作。对后台任务（记忆整理）这无所谓；但技能面板是个高频 UI，你点开面板只是想看一眼技能列表，却撞见 agent 在自动改写分类表——这个体验是有争议的，而且它会花你的 token。

**② 判定「这是新技能」需要一份基线。** 插件每次都是全量扫盘，本身没有「上次处理到哪」的记忆。要自动，就得再存一份已处理技能的快照（按 name + 描述哈希），多一个状态文件、多一类需要迁移和清理的数据。

**③ 自动生成的质量会低于一次显式调用。** 分类判据里有大量边界：「写文档 ≠ 文档」「`pr` 该归调研」「`prototype` 该归需求」这类需要揣摩技能实际用法；中文备注更要求读懂它在什么场景下被用。顺手做的版本大概率比不上专门做一遍。更麻烦的是**它错了不会报错**——只是安静地待在一个错的 chip 里，没人发现。

所以当前的取舍是：**把你「记得去调哪个技能」的负担降到零（插件自带它、面板上就能看到它），而不是把你「审一眼结果」的机会也一起拿走。**

如果以后确实想要全自动，可行路线是加一个**默认关闭**的开关（设置里打开才走 pre-step 自动模式），或者做成「面板上显示『有 N 个技能未分类』，点一下补」——后者不插话、也不花多余 token，是更稳妥的一步。这些都还没做。

## 文档在哪

| 想看什么 | 去哪 |
| --- | --- |
| 完整功能说明、分类表、用法、原理、更新日志 | [`plugin/README.md`](plugin/README.md) |
| 动手改这个插件 | [`AGENTS.md`](AGENTS.md)（三副本结构与同步纪律） |
| 参与贡献 | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Issue 跟踪与分诊约定 | [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md) |

## 仓库结构

```
plugin/          ← 插件的真相源（Git 跟踪的就是这份）
  src/           ← 可读的源码（client 半 + host 半）
  lib/           ← 实际运行的编译产物；无构建链，与 src 手维护同步
  bundled-skills/← 随包技能
  scripts/       ← 把 src 内联进 lib 的手工工具（幂等可重跑）
docs/agents/     ← 工程技能读取的约定
backup/          ← 本地回滚件（不进仓库）
```

> **`plugin/` 是真相源，但它不是实际在跑的那份。** 详见 [`AGENTS.md`](AGENTS.md)——
> 改代码必须同步到 profile 的 `local-plugins/` 与 `node_modules/` 两处，否则下次
> `pnpm install` 会把改动冲掉。

## 贡献

Issue 与 PR 都欢迎。发现 Bug 请附上：DSH 版本、操作系统、在哪个面板看到的（本机输入框旁有**两个** ⚡，左边是 `dsh-skill-market`，右边才是本插件）、以及控制台的 `[dsh-skill-catalog]` 日志。

## License

MIT
