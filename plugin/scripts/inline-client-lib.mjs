/**
 * 把 `src/client/` 下**纯 createElement、零依赖**的模块内联进手维护的
 * `lib/client.js` bundle。
 *
 * 为什么需要它：这个 fork 没有客户端构建链（见 AGENTS.md —— 上游的 `build.mjs`
 * 被裁掉、esbuild 也没装），`lib/client.js` 是一份手维护的 esbuild 产物。为了让
 * "手抄一份到 bundle 里"不引入转录错误，这几个模块一律写成不带 JSX、只收一个
 * React 参数的形态，于是可以**整段原样**粘进去。两份内容因此逐字相同（除了
 * `export` 前缀和 bundle 的 `\uXXXX` 转义）。
 *
 * 幂等：每段用 `#region` / `#endregion` 标记界定，重跑会先移除旧段再写入。
 *
 *   node scripts/inline-client-lib.mjs
 *
 * @module dsh-skill-catalog/scripts/inline-client-lib
 */

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const TARGET = path.join(root, 'lib', 'client.js')
const APPLY_ANCHOR = 'function apply(ctx) {'

/**
 * `instantiate` 是模块加载后要执行的语句；`null` 表示只提供函数，不预先实例化。
 */
const MODULES = [
  {
    source: path.join('src', 'client', 'preset-manager.js'),
    exportName: 'createPresetManager',
    instantiate: 'var PresetManager = createPresetManager(import_react.default);',
  },
  {
    source: path.join('src', 'client', 'workspace-menu.js'),
    exportName: 'installWorkspacePresetMenu',
    instantiate: null,
  },
]

function regionBegin(rel) {
  return `// #region ${rel.replaceAll('\\', '/')} (inlined by scripts/inline-client-lib.mjs)`
}

function regionEnd(rel) {
  return `// #endregion ${rel.replaceAll('\\', '/')}`
}

/** 源码 → 可内联的 ASCII-only 代码块（去 export，转义非 ASCII）。 */
function blockFor(module) {
  const source = readFileSync(path.join(root, module.source), 'utf8')
  const body = source
    .replace(new RegExp(`^export function ${module.exportName}\\(`, 'mu'), `function ${module.exportName}(`)
    .trimEnd()
  // `lib/client.js` 是 `charset: ascii` 的 esbuild 产物：里面每个非 ASCII 字符都是
  // `\uXXXX`。这里跟着转义，bundle 就不依赖任何代码页。
  const ascii = body.replace(/[^\x00-\x7f]/gu, (char) => (
    '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')
  ))
  const lines = [regionBegin(module.source), ascii]
  if (module.instantiate !== null) lines.push(module.instantiate)
  lines.push(regionEnd(module.source), '')
  return lines.join('\n')
}

/** 移除某段旧内容（连同标记），返回新文本。 */
function strip(text, module) {
  const begin = regionBegin(module.source)
  const end = regionEnd(module.source)
  const start = text.indexOf(begin)
  if (start === -1) return text
  const finish = text.indexOf(end, start)
  if (finish === -1) {
    console.error(`找到 ${begin} 却没有对应的结束标记，拒绝改动`)
    process.exit(1)
  }
  return text.slice(0, start) + text.slice(finish + end.length)
}

let bundle = readFileSync(TARGET, 'utf8')

// 先按模块移除旧段，再统一插入，重跑永远只有一个副本。
for (const module of MODULES) bundle = strip(bundle, module)
bundle = bundle.replace(/^\n+/u, '')

const anchor = bundle.indexOf(APPLY_ANCHOR)
if (anchor === -1) {
  console.error(`找不到锚点：${APPLY_ANCHOR}`)
  process.exit(1)
}

const injected = MODULES.map(blockFor).join('\n')
bundle = bundle.slice(0, anchor) + injected + bundle.slice(anchor)

writeFileSync(TARGET, bundle, 'utf8')
console.log(`inlined ${MODULES.length} module(s) → ${path.relative(root, TARGET)}`)
