/**
 * 分类表自测：对「面板实际会显示的技能名」跑一遍 categoryOf / categoriesPresent。
 *
 * 技能名来源两条：
 *  1. 宿主 explorer 路由（bundled / custom / runtime 全量）
 *  2. 磁盘扫描（用户自装的那批）
 * 任一取不到就用本地快照兜底，保证脚本在没有 DSH 运行时也能跑。
 */
import { categoryOf, categoriesPresent, CATEGORIES, CATEGORY_MAP, CATEGORY_ALL } from '../src/client/categories.js'

const FALLBACK = [
  // bundled
  'ask-matt', 'browser-skill', 'code-review', 'codebase-design', 'diagnose-windows-sandbox-acl',
  'diagnosing-bugs', 'domain-modeling', 'grill-me', 'grill-with-docs', 'handoff', 'implement',
  'implement-spec', 'improve-codebase-architecture', 'office-docx', 'office-pptx', 'office-xlsx',
  'pr', 'prototype', 'research', 'retro', 'setup-matt-pocock-skills', 'tdd', 'teach',
  'to-questionnaire', 'to-spec', 'to-tickets', 'triage', 'univer', 'univer-base', 'univer-board',
  'univer-cross-unit-formula', 'univer-doc', 'univer-embed', 'univer-sheet', 'univer-slide',
  'wait-what', 'wayfinder', 'wizard',
  // custom
  'brainstorming', 'diagnosing-superpowers', 'dispatching-parallel-agents', 'executing-plans',
  'finishing-a-development-branch', 'receiving-code-review', 'requesting-code-review',
  'subagent-driven-development', 'systematic-debugging', 'test-driven-development',
  'using-git-worktrees', 'using-superpowers', 'verification-before-completion', 'writing-plans',
  'writing-skills',
  // user / runtime
  'dev-god', 'self-improvement', 'dify-deploy', 'dify-workflow', 'grilling', 'motion-web',
  'obsidian-curator', 'oil-tone', 'oil-ui', 'sync-catalog-zh-descriptions', 'writing-for-agents',
  'dsh-chat-import-convert', 'agent-browser',
]

async function fromExplorer() {
  try {
    const res = await fetch('http://127.0.0.1:19387/api/dsh-skill-explorer/list', {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const json = await res.json()
    const out = []
    for (const group of Array.isArray(json?.groups) ? json.groups : []) {
      for (const skill of Array.isArray(group?.skills) ? group.skills : []) {
        if (typeof skill?.name === 'string' && skill.name !== '') out.push(skill.name)
      }
    }
    return out
  } catch {
    return []
  }
}

const live = await fromExplorer()
const names = [...new Set(live.length > 0 ? live : FALLBACK)]
if (live.length > 0) console.log(`技能名来源：explorer 路由（${names.length} 个）`)
else console.log(`技能名来源：本地快照（${names.length} 个，路由不可用）`)

const skills = names.map((name) => ({ name }))
const uncategorized = skills.filter((s) => categoryOf(s) === '')
const chips = categoriesPresent(skills)

console.log('\n=== chips ===')
for (const chip of chips) {
  const count = skills.filter((s) => categoryOf(s) === chip.key).length
  console.log(`${chip.key.padEnd(4)} (${chip.full}) x${count}`)
}

console.log('\n=== 未分类 ===')
console.log(uncategorized.length === 0 ? '（无）' : uncategorized.map((s) => s.name).join(', '))

// 断言
const problems = []
if (uncategorized.length > 0) problems.push(`${uncategorized.length} 个技能未分类`)

const known = new Set(CATEGORIES.map((c) => c.key))
for (const [name, cat] of Object.entries(CATEGORY_MAP)) {
  if (!known.has(cat)) problems.push(`CATEGORY_MAP["${name}"] 的分类 "${cat}" 不在 CATEGORIES 里`)
}

const dupKeys = Object.keys(CATEGORY_MAP).filter((k, i, arr) => arr.indexOf(k) !== i)
if (dupKeys.length > 0) problems.push(`重复键: ${dupKeys.join(', ')}`)

// 表里有、实际技能列表里没有的键（改名/卸载后的残留）
const nameSet = new Set(names)
const stale = Object.keys(CATEGORY_MAP).filter((k) => !nameSet.has(k))
if (stale.length > 0) console.log(`\n=== 表里有但当前不存在（改名/未装，可清理）===\n${stale.join(', ')}`)

console.log('\n=== 断言 ===')
if (problems.length === 0) console.log('全部通过')
else {
  console.log('失败：')
  for (const p of problems) console.log(' - ' + p)
  process.exitCode = 1
}

// CATEGORY_ALL 必须是空串，且不等于任何分类
if (CATEGORY_ALL !== '') throw new Error('CATEGORY_ALL 必须是空串')
