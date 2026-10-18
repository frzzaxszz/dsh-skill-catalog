/**
 * 技能分类表 —— 只影响 ⚡ 面板的**筛选与显示层**。
 *
 * 为什么是本地映射表，而不是改 SKILL.md：
 *
 * 1. `description` 是喂给模型的，`category` 不是 DSH 的官方 frontmatter 字段，
 *    写进 60+ 个技能也换不来任何宿主行为，只是把维护成本摊到每个文件上。
 * 2. bundled / custom 技能住在 `node_modules` 里，插件一升级就覆盖，改文件必丢。
 * 3. 和 `zh-descriptions.js` 同一条路：一张表、随时可改、可整体撤掉。
 *
 * 唯一的例外是**技能自己声明**的分类：frontmatter 写了 `category: 工程` 就用它
 * （`categoryOf` 优先读 `skill.category`），所以将来自己写的技能想自带分类时，
 * 不用回来改这张表。表里查不到的落「未分类」，未分类不单独成一个 chip，
 * 只在「全部」里出现 —— 与面板「误归一类代价远小于丢一个技能」的老原则一致。
 *
 * @module dsh-skill-catalog/client/categories
 */

/** 「全部」的哨兵值：不是分类名，代表不筛选。 */
export const CATEGORY_ALL = ''

/**
 * 分类的顺序与短名。chip 上用两字短名省宽度（面板只有 340px），
 * 全名放 `title` 里，鼠标悬停才出现。
 *
 * 顺序即展示顺序：越靠前越常用。
 */
export const CATEGORIES = [
  { key: '工程', full: '工程开发', hint: '写码、实现、评审、计划、分支收尾' },
  { key: '排错', full: '诊断排错', hint: 'Bug、性能回归、会话复盘、沙箱 ACL' },
  { key: '需求', full: '需求打磨', hint: '追问、规格、工单、分诊、原型' },
  { key: '设计', full: '前端设计', hint: '界面、动效、文案语气' },
  { key: '文档', full: '文档办公', hint: 'Word / Excel / PPT / Univer' },
  { key: '调研', full: '调研写作', hint: '调研、教学、交接、导入、笔记' },
  { key: '技能', full: '技能管理', hint: '写技能、用技能、自我改进' },
  { key: '自动化', full: '自动化', hint: '浏览器、桌面、Dify 工作流' },
]

/** 短名 → 全名，供 chip 的 title 提示。 */
export const CATEGORY_FULL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.full]))

/** 短名 → 一句话说明，供 chip 的 title 提示。 */
export const CATEGORY_HINT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.hint]))

/**
 * name → 分类短名。表里没有的技能落空串（未分类），面板上并进「全部」。
 *
 * 键必须是官方技能名（小写连字符）。`Self-Improving + Proactive Agent`
 * 那条是 `$DSH_HOME/skills/self-improving` 的 frontmatter `name` 原文，
 * 保留空格与加号，别"顺手规范化"——名字对不上就等于没分类。
 */
export const CATEGORY_MAP = {
  // ── 工程：写码、实现、评审、计划、分支 ─────────────────────────────
  tdd: '工程',
  'test-driven-development': '工程',
  implement: '工程',
  'implement-spec': '工程',
  'code-review': '工程',
  'receiving-code-review': '工程',
  'requesting-code-review': '工程',
  'codebase-design': '工程',
  'domain-modeling': '工程',
  'improve-codebase-architecture': '工程',
  'writing-plans': '工程',
  'executing-plans': '工程',
  'finishing-a-development-branch': '工程',
  'using-git-worktrees': '工程',
  'dispatching-parallel-agents': '工程',
  'subagent-driven-development': '工程',
  'verification-before-completion': '工程',
  'dev-god': '工程',

  // ── 排错：出问题了才用，和「工程」分开，因为它是一条独立的流程 ──────
  'diagnosing-bugs': '排错',
  'systematic-debugging': '排错',
  'diagnosing-superpowers': '排错',
  'diagnose-windows-sandbox-acl': '排错',

  // ── 需求：动手之前把想干什么问清楚 ────────────────────────────────
  'grilling': '需求',
  'grill-me': '需求',
  'grill-with-docs': '需求',
  brainstorming: '需求',
  'to-spec': '需求',
  'to-tickets': '需求',
  'to-questionnaire': '需求',
  triage: '需求',
  wayfinder: '需求',
  prototype: '需求',
  'wait-what': '需求',
  'ask-matt': '需求',

  // ── 设计：看得见的那一层 ──────────────────────────────────────────
  'oil-ui': '设计',
  'motion-web': '设计',
  'oil-tone': '设计',

  // ── 文档：Office 与 Univer 两套，产出的是文件 ─────────────────────
  'office-docx': '文档',
  'office-xlsx': '文档',
  'office-pptx': '文档',
  univer: '文档',
  'univer-base': '文档',
  'univer-board': '文档',
  'univer-cross-unit-formula': '文档',
  'univer-doc': '文档',
  'univer-embed': '文档',
  'univer-sheet': '文档',
  'univer-slide': '文档',

  // ── 调研：读、写、交接、导入 ──────────────────────────────────────
  research: '调研',
  teach: '调研',
  'writing-for-agents': '调研',
  handoff: '调研',
  'dsh-chat-import-convert': '调研',
  'obsidian-curator': '调研',
  pr: '调研',
  retro: '调研',

  // ── 技能：管这套技能本身 ──────────────────────────────────────────
  'writing-skills': '技能',
  'using-superpowers': '技能',
  'self-improvement': '技能',
  'Self-Improving + Proactive Agent': '技能',
  'setup-matt-pocock-skills': '技能',
  'sync-catalog-zh-descriptions': '技能',

  // ── 自动化：对外部世界动手 ────────────────────────────────────────
  'browser-skill': '自动化',
  'agent-browser': '自动化',
  'dify-workflow': '自动化',
  'dify-deploy': '自动化',
  wizard: '自动化',
}

/**
 * 一个技能的分类短名，或空串（未分类）。
 *
 * 优先用技能自己声明的 `category`（host 扫描从 frontmatter 读出来、
 * 注册表若将来带上也照收），其次查表。未知的一律空串 —— 宁可让它
 * 出现在「全部」里，也不能因为分错类而从某个 chip 里消失。
 *
 * @param skill - `{ name, category }`
 * @returns 分类短名（`工程` / `排错` / …）或 `''`
 */
export function categoryOf(skill) {
  const declared = typeof skill?.category === 'string' ? skill.category.trim() : ''
  if (declared !== '') return declared
  const name = typeof skill?.name === 'string' ? skill.name : ''
  const mapped = CATEGORY_MAP[name]
  return typeof mapped === 'string' ? mapped : ''
}

/**
 * 当前列表里**实际存在**的分类，按 `CATEGORIES` 的顺序。
 *
 * 空分类不出 chip：一个点进去必然空白的按钮，比没有这个按钮更糟。
 * 表外的分类（技能自己声明的、不在 CATEGORIES 里的）排在最后，用原名。
 *
 * @param skills - 面板当前展示的技能数组（已排除已关闭的）。
 * @returns `[{ key, full, hint }]`
 */
export function categoriesPresent(skills) {
  const seen = new Set()
  for (const skill of Array.isArray(skills) ? skills : []) {
    const key = categoryOf(skill)
    if (key !== '') seen.add(key)
  }
  const known = CATEGORIES.filter((c) => seen.has(c.key))
  const extra = [...seen]
    .filter((key) => !CATEGORIES.some((c) => c.key === key))
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({ key, full: key, hint: '' }))
  return known.concat(extra)
}
