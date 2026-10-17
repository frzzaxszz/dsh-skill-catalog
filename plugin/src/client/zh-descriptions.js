/**
 * 中文备注映射表 —— 只影响 ⚡ 面板与 `/` 菜单的**显示层**。
 *
 * 为什么单独一个文件、为什么不动 SKILL.md：
 *
 * 1. `description` 是喂给模型的。改 SKILL.md 会连带改变模型的技能选择判断，
 *    而这批 bundled/custom 技能的原文是上游作者写的、经过验证的路由提示。
 * 2. bundled 技能住在 `node_modules` 里（deck 的 bundled-skills、superpowers-dsh
 *    的 skills、univer、office…），插件一升级就被覆盖，改文件必丢。
 * 3. 显示层字典可以随时撤、随时改，不影响任何技能的加载与调用。
 *
 * 覆盖范围：bundled(38) + custom(15) = 53 个 —— 也就是 picker 的备胎扫描
 * （只读 ~/.agents/skills 与 $DSH_HOME/skills）结构上看不见的那两批。
 * 用户自己装的 10 个技能保持原文，不在此表内。
 *
 * 查不到名字时 `zhDescription()` 原样返回英文 description，所以新装的技能
 * 不会变成空白，只会回落英文 —— 这正是"映射表"该有的退化行为。
 *
 * @module dsh-skill-catalog/client/zh-descriptions
 */

/** name → 中文备注。键必须是官方技能名（小写连字符）。 */
export const ZH_DESCRIPTIONS = {
  // ── bundled：mattpocock 工程技能套件 ──────────────────────────────
  'ask-matt': '不知道用哪个技能？让它根据你的处境推荐合适的技能或流程。',
  'code-review': '审查自某个固定点（提交/分支/标签/合并基点）以来的改动，沿两条轴并行评审：规范（是否遵循本仓库约定的编码标准）与规格（是否命中原始 issue/spec 的要求），并排给出报告。适用于想审查分支、PR、未提交改动，或说「 review since X 」。',
  'codebase-design': '深模块设计的共享词汇表。想设计或改进模块接口、寻找深化机会、决定接缝放在哪、让代码更可测更易被 AI 导航时使用。',
  'diagnosing-bugs': '疑难 Bug 与性能回归的诊断循环。用户说「诊断一下」「debug 这个」，或报告东西坏了/在抛异常/失败/变慢时使用。',
  'domain-modeling': '建立并打磨项目的领域模型。讨论代码库术语、编写或修改 GLOSSARY.md、记录或编辑 ADR 时使用。',
  'grill-me': '对某个计划或设计进行毫不留情的连环追问，用来把它打磨锋利。',
  'grill-with-docs': '同 grill-me 的连环追问，同时把结论沉淀成文档（ADR 与术语表）。',
  'handoff': '把当前对话压缩成一份交接文档，供另一个 agent 接手。',
  'implement': '依据一份规格或一组工单，把一块工作实现出来。',
  'implement-spec': '把 /to-spec 与 /to-tickets 的产出落成代码。',
  'improve-codebase-architecture': '扫描代码库寻找深化机会，生成可视化 HTML 报告，然后针对你挑中的那一个展开追问。',
  'pr': '写 PR 描述时使用。',
  'prototype': '做一个用完即弃的原型来回答某个设计问题。用户想快速验证状态模型或逻辑是否顺手、想看界面大概长什么样时使用。',
  'research': '针对高可信度的一手来源调研一个问题，把结论写成仓库里的 Markdown 文件。用户想调研某个主题、收集文档或 API 事实、或把查阅工作交给后台 agent 时使用。',
  'retro': '对一次编码会话做复盘。',
  'setup-matt-pocock-skills': '为这套工程技能配置当前仓库：搭好 issue 跟踪、分诊标签词汇表与领域文档结构。首次使用其他工程技能前跑一次。',
  'tdd': '测试驱动开发。用户想先写测试再实现功能或修 Bug、提到「红-绿-重构」、或需要集成测试时使用。',
  'teach': '在当前工作区内教用户一项新技能或一个新概念。',
  'to-questionnaire': '把一个你无法完全回答的决策，转成一份问卷交给别人填写。',
  'to-spec': '把当前对话整理成一份规格并发布到项目的 issue 跟踪器。不做访谈，只对已经讨论过的内容做综合。',
  'to-tickets': '把一个计划、规格或当前对话拆成一组 tracer-bullet 工单，每张声明自己的阻塞边，发布到配置好的跟踪器（本地是每张工单一个文件、边写成文本；真实跟踪器上则是原生阻塞链接）。',
  'triage': '让 issue 与外部 PR 走一遍分诊角色状态机：归类、验证、必要时追问，并写出可供 agent 直接执行的简报。',
  'wait-what': '停。上一条没说到点上：重新讲一遍。',
  'wayfinder': '把一大块工作（超出单个 agent 会话容量）规划成 issue 跟踪器上的一张决策工单地图，然后逐个解决，直到通往目标的路清晰起来。',
  'wizard': '生成一个交互式 bash 向导，带着人一步步完成只有他们能做的操作。用于开通基础设施、配置凭据或 CI 密钥、走陌生的第三方后台、或一次性迁移与切换。agent 自己能做的步骤不要用它。',

  // ── bundled：诊断 / 浏览器 / Office / Univer ───────────────────────
  'diagnose-windows-sandbox-acl': 'Windows 上遇到意料之外的 DSH 沙箱拒绝时使用：工作区写入或列目录失败、或一个本来可读的路径读不了。内置命令会检查该路径及其每一级上级，并在同一次运行中修复它证明存在的 ACL 问题。属于预期内的隔离拒绝则不需要修 ACL。',
  'browser-skill': '通过插件注入的 bsk_* 工具自动化操作用户已登录的 Chromium。用来读页面、填表单、操作标签页、检查页面活动、调试网站或测试 UI。',
  'office-docx': '创建、读取、编辑并检查 Word 文档（.docx），含报告、信函与带格式的表格。DOCX 作为输入或交付物时使用。运行 Office 命令前先加载本技能。除用户明确 opt out，否则只用自带的 LibreOffice，不要去找别的 LibreOffice 可执行文件。',
  'office-pptx': '创建、读取、编辑并检查 PowerPoint 演示文稿（.pptx），含幻灯片文字、表格、图片与图表。PPTX 作为输入或交付物时使用。运行 Office 命令前先加载本技能。除用户明确 opt out，否则只用自带的 LibreOffice，不要去找别的 LibreOffice 可执行文件。',
  'office-xlsx': '读取、创建并修改 Excel 工作簿（.xlsx），含数据、公式、格式与 pandas 分析。Excel 作为输入或交付物时使用。数据与公式类任务跳过视觉检查，只有涉及格式或排版才看。除用户明确 opt out，否则只用自带的 LibreOffice。',
  'univer': '通过 DSH 工具与隔离 worktree 创建、检视、编辑、导入、导出并交接多 Unit 的 .univer 文件。任何涉及 .univer 文件、表格或 .xlsx/.csv/.tsv 数据、演示文稿或 .pptx 幻灯片、.docx 文档、Base 数据库、Board 画布、跨 Unit 内容、或需要精确编写 Univer Facade API 的任务都应主动使用；加载对应的 Unit 技能前先加载本技能。',
  'univer-base': '通过 DSH 工具与 Lite 界面创建、编辑、计算、检视、导出并评审 Univer Base 数据库 Unit。任何 Base 表、字段、记录、视图、公式字段、结构化引用、Sheet 外部引用、Base 导入导出，或 Base Unit 任务都应主动使用。',
  'univer-board': '通过 DSH 工具与 Lite 界面创建、编辑、制图、检视、导出并评审 Univer Board 画布 Unit。任何 Board 形状、文字、连接线、路由、图片、原生图表、图示、画布布局，或 Board Unit 任务都应主动使用。',
  'univer-cross-unit-formula': '通过 DSH 工具与 Lite 界面编写、计算、更新、检视并验证跨 Unit 公式。当 Sheet 单元格或 Sheet/Doc/Slide/Board 中由公式驱动的形状要读取同一 .univer 文件里另一个 Unit 的 Sheet 区域或 Base 表列时使用。',
  'univer-doc': '通过 DSH 工具与 Lite 界面读取、创建、分页、制图、检视、导出并评审 Univer Doc Unit。任何段落、富文本、列表、任务、表格、图片、图表、页眉页脚、页面设置、传统或现代文档、docx 导入导出，或 Doc Unit 任务都应主动使用。',
  'univer-embed': '通过 DSH 工具与 Lite 界面把一个 Univer Unit 嵌进另一个 Unit。当 Sheet、Doc、Slide、Base、Board、仪表盘、报告、演示文稿、数据库或画布需要展示或交互同一 .univer 文件里另一个 Unit 的内容时使用。',
  'univer-sheet': '通过 DSH 工具与 Lite 界面读取、写入、格式化、计算并验证 Univer Sheet Unit。任何表格值、公式、区域、表格、图表、图片、数据验证、筛选、透视、富文本、xlsx/csv/tsv 导入导出，或 Sheet Unit 任务都应主动使用。',
  'univer-slide': '通过 DSH 工具与 Lite 界面创建、重设计、编辑、检视、lint、导出并评审 Univer Slide Unit。任何交付物是演示文稿的任务都应主动使用；生成的页面应用 univer_compile_svg，每个改过的页面都应跑 univer_lint。',

  // ── custom：superpowers 工作流技能 ─────────────────────────────────
  'brainstorming': '任何创作性工作之前必须使用——新建功能、构建组件、添加能力或修改行为。在动手之前先把用户意图、需求与设计探清楚。',
  'diagnosing-superpowers': 'superpowers 会话出了问题时使用：重复劳动、计划被无视、磕磕绊绊、结果差、技能没触发、「太慢了」、「怎么这么贵」、「它在干什么」——或是想为 superpowers 维护者攒一份 bug 报告，针对当前会话或某个指定的 id/路径，不限 harness。',
  'dispatching-parallel-agents': '面对 2 个以上相互独立、无共享状态、无顺序依赖的任务时使用。',
  'executing-plans': '在当前会话里由你自己充当执行者来实施一份实现计划时使用——你的搭档选择了内联执行，或没有 subagent 工具可用。',
  'finishing-a-development-branch': '实现完成、测试全绿，需要决定怎么把工作合并回去时使用。',
  'receiving-code-review': '收到代码评审意见后、动手实现建议之前使用，尤其是当反馈含糊或技术上可疑时——需要技术上的严谨与验证，而不是表演式的认同或照单全收。',
  'requesting-code-review': '完成任务、实现重要功能、或准备合并前，用来验证工作是否满足要求。',
  'subagent-driven-development': '在当前会话里执行含有独立任务的实现计划时使用。',
  'systematic-debugging': '遇到任何 Bug、测试失败或意料之外的行为，在提出修复方案之前使用。',
  'test-driven-development': '开发任何功能或修任何 Bug 之前、还没写实现代码时使用。',
  'using-git-worktrees': '开始需要隔离的 feature 工作、或执行实现计划之前使用——确保存在一个隔离的工作区，优先用原生工具，不行就退回 git worktree。',
  'using-superpowers': '每次对话开始时使用——建立如何寻找与使用技能的机制，要求在任何回应（含澄清问题）之前先调用技能。',
  'verification-before-completion': '准备宣称工作已完成/已修复/已通过，或在提交、建 PR 之前使用——必须先跑验证命令并确认输出，先有证据再有结论。',
  'writing-plans': '有一个规格或需求、要动一个多步骤任务的代码之前使用。',
  'writing-skills': '创建新技能、修改已有技能、或验证技能能否正常工作然后上线时使用。',

  // ── 用户自装技能（~/.agents/skills、$DSH_HOME/skills）─────────────────
  // 这些在磁盘扫描里，而磁盘优先 —— 同名会 shadow 掉 bundled 那条，
  // 所以要补的是这里，补 bundled 分组那条面板上看不见。
  'grilling': '对某个计划、决策或想法进行毫不留情的连环追问。用户想压力测试自己的思路，或使用了任何 grill 类触发语时使用。',
  'self-improvement': '沉淀经验、错误与纠正，实现持续改进。以下情形使用：(1) 命令或操作意外失败；(2) 用户纠正你（「不对…」「其实…」）；(3) 用户要求一个不存在的能力；(4) 外部 API 或工具失败；(5) 你意识到自己的知识已过时或错误；(6) 发现某个重复任务的更好做法。重大任务前也应回顾这些经验。',
  'Self-Improving + Proactive Agent': '自我反思 + 自我批评 + 自我学习 + 自组织记忆。agent 评估自己的工作、抓住错误并永久改进。以下情形使用：(1) 命令、工具、API 或操作失败；(2) 用户纠正你或否定了你的工作；(3) 你意识到知识过时或错误；(4) 发现了更好的做法；(5) 用户为当前任务显式安装或引用了本技能。',
  'writing-for-agents': '写给 agent 看的文档。创建或修改技能、或改动 AGENTS.md / CLAUDE.md 时使用。',
  'agent-browser': '面向 AI agent 的浏览器自动化 CLI。用户需要与网站交互时使用：翻页、填表单、点按钮、截图、抽取数据、测试 web 应用，或任何浏览器任务。触发语包括「打开网站」「填表」「点按钮」「截图」「抓取页面」「测试这个应用」「登录站点」「自动化浏览器操作」，或任何需要程序化网页交互的任务。',

  // ── 混合备注修正：原 description 是「英文为主 + 末尾挂一句中文」──────────
  // CJK 占比过低（<0.35），按「含 CJK 就算有中文」的旧判据会被漏掉，
  // 面板上看着仍是英文。这里补成纯中文。
  'dsh-chat-import-convert': '把任意外部对话记录转成可导入的 dsh-chat-import interchange v1 JSON 文档。支持 Claude、Codex、ChatGPT、Cursor、Gemini、opencode、Kimi、Qoder 等 29 种格式；单文件转单会话、目录转批量，可按需保留压缩检查点与图片。',
  'motion-web': '设计并构建以动效为先的创意网站：页面设计（结构、字号、配色、间距）加交互编排（滚动动画、Framer Motion、GSAP、轻量 3D）。覆盖动态落地页、作品集、产品展示、动效审计，以及手感调优（不跟手/太生硬）、按视频或 URL 参考复刻、把平面素材做出伪 3D 层次、诊断滚动时间线空段。不用于仪表盘、后台 UI 或完整 3D 场景生成。',
  'oil-ui': '设计、改进并评审网站、App、后台与组件的界面：探索不同设计方向、多风格同屏对比、按实际截图打磨视觉层级。交付对比页、设计说明、设计稿或可运行界面。不用于纯业务逻辑、接口、构建部署、无界面变化的代码整理。若已安装 oil-ui-pro 则交给它。',
}

/**
 * 技能的中文备注：表里有就用中文，没有就原样返回英文 description。
 *
 * 只有一个方向 —— 永不写回 skill 对象、永不改 SKILL.md，所以模型的
 * 技能路由判断不受影响，插件升级也不会冲突。
 *
 * @param skill - `{ name, description }`
 * @returns 展示用备注字符串（可能为空串）
 */
export function zhDescription(skill) {
  const name = typeof skill?.name === 'string' ? skill.name : ''
  const zh = ZH_DESCRIPTIONS[name]
  if (typeof zh === 'string' && zh !== '') return zh
  return typeof skill?.description === 'string' ? skill.description : ''
}
