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
dsh plugin --profile web add "git+https://github.com/frzzaxszz/dsh-skill-catalog.git"
```

固定到某个 commit：

```sh
dsh plugin --profile web add "git+https://github.com/frzzaxszz/dsh-skill-catalog.git#<commit-sha>"
```

重启 `dsh web`（或刷新页面）即生效。

> 国内 HTTPS 受限时改用 SSH：
> `dsh plugin --profile web add "git+ssh://git@github.com:frzzaxszz/dsh-skill-catalog.git"`
> 或先执行 `git config --global url."git@github.com:".insteadOf "https://github.com/"`

## 自带技能

装插件会**一并装上**它自己的维护技能，不需要另外手放到 `~/.agents/skills`：

| 技能 | 什么时候用 |
| --- | --- |
| `sync-catalog-zh-descriptions` | 新装了技能、面板上还有英文备注、或新技能没落进分类 chip 时，调它一次，**同时**补中文备注与分配分类 |

因为 DSH 读技能的四个根（`~/.agents/skills`、`$DSH_HOME/skills`、`<cwd>/.agents/skills`、`<cwd>/.dsh/skills`）都不包含 `node_modules`，光把文件塞包里没人读得到——所以 host 半边启动时向 `skills` 服务注册了一个 provider（rank 350），机制与 `dsh-mattpocock-skills-deck` 的随包技能一致。

优先级：项目级（100/200）> 随包（350）> 你自己装在 `~/.agents/skills` 的同名副本（500）。**同名的以你那份为准**——用户的选择优先。

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
