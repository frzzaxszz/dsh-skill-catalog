/**
 * 随包技能 provider —— 让本插件自带的那几个技能随插件一起出现。
 *
 * 为什么需要它：插件只能往 `node_modules` 里塞文件，而 DSH 读取技能的四个
 * 根（`~/.agents/skills`、`$DSH_HOME/skills`、`<cwd>/.agents/skills`、
 * `<cwd>/.dsh/skills`）都不包含 `node_modules`。所以不注册 provider 的话，
 * 仓库里的 `bundled-skills/` 只是一堆没人读的文件。
 *
 * 机制与 `dsh-mattpocock-skills-deck` 的 `bundled-mattpocock` provider 一致
 * （同一个 `ctx.get('skills').registerProvider` 接口）：返回一个带 `list`/`get`
 * 的对象，provider 自己负责读磁盘、解析 frontmatter、上报 `invocation` 与
 * `resourceBase`。
 *
 * rank 取 350：高于 `custom(300)`？不 —— 350 落在 `runtime(250)` 与
 * `custom(300)` 之间，实际语义是「随包技能优先于用户家目录里的同名旧副本
 * （400/500），但让位给项目级（100/200）与 custom」。用户若自己装了一份
 * 同名技能到 `~/.agents/skills`，会盖住随包这份 —— 那是用户的选择，尊重它。
 *
 * 所有失败都吞掉并降级为「没注册」：一个技能 provider 不该让整个插件起不来。
 *
 * @module dsh-skill-catalog/bundled-skills
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** 随包技能在本包内的目录名。 */
const BUNDLED_DIR_NAME = 'bundled-skills'

/** 数字越小越优先；见模块头注释。 */
const BUNDLED_RANK = 350

/** provider 名字，出现在 `skills/list` 的 `provider` 字段里。 */
const PROVIDER_NAME = 'dsh-skill-catalog-bundled'

/** 与本文件同级的 `bundled-skills/` 的绝对路径。 */
function bundledDir() {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', BUNDLED_DIR_NAME)
}

/** SKILL.md 的 frontmatter 块，或 undefined。 */
function frontmatterBlock(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  return match === null ? undefined : match[1]
}

/**
 * 极简 frontmatter 解析：只认本插件自带技能用得到的那些键。
 *
 * 不引入 YAML 库是刻意的 —— 随包技能是我们自己写的，格式由我们控制，
 * 而插件多一个运行时依赖就多一个装不上的可能。
 *
 * @param content - SKILL.md 全文
 * @returns `{ name, description, body }`，解析不出 name 时返回 undefined
 */
function parseSkill(content) {
  const block = frontmatterBlock(content)
  if (block === undefined) return undefined
  const meta = {}
  for (const line of block.split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!kv) continue
    const value = kv[2].trim().replace(/^["']|["']$/g, '')
    if (value !== '') meta[kv[1]] = value
  }
  if (typeof meta.name !== 'string' || meta.name === '') return undefined
  return {
    name: meta.name,
    description: meta.description ?? '',
    body: content.slice(content.indexOf(block) + block.length).replace(/^\s*---\s*/, '').trim(),
  }
}

/** 技能名合法性，与官方 provider 的 kebab-case 规则一致。 */
function isValidSkillName(name) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(name)
}

/** 一个技能目录 → provider 的 list 条目；读不到或解析失败返回 undefined。 */
async function readEntry(dir, dirName) {
  const entryPath = path.join(dir, dirName, 'SKILL.md')
  let content
  try {
    content = await readFile(entryPath, 'utf8')
  } catch {
    return undefined
  }
  const parsed = parseSkill(content)
  if (parsed === undefined) return undefined
  const skillDir = path.join(dir, dirName)
  return {
    name: parsed.name,
    description: parsed.description,
    // 随包技能都是「人和模型都能调用」，与官方默认语义一致。
    invocation: { modelInvocable: true, userInvocable: true },
    source: 'bundled',
    provider: PROVIDER_NAME,
    rank: BUNDLED_RANK,
    locator: { path: entryPath, directory: skillDir },
    resourceBase: { kind: 'directory', path: skillDir },
    path: entryPath,
  }
}

/** 本包自带的技能目录名清单（只读一次目录）。 */
async function listEntryNames(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((entry) => entry.isDirectory() && isValidSkillName(entry.name))
    .map((entry) => entry.name)
}

/** 构造 provider 对象（不注册，方便单测）。 */
export function createBundledSkillProvider() {
  const dir = bundledDir()
  return {
    name: PROVIDER_NAME,
    async list(opts) {
      try {
        if (opts?.signal?.aborted === true) throw opts.signal.reason
        const names = await listEntryNames(dir)
        const out = []
        for (const name of names) {
          const entry = await readEntry(dir, name)
          // 目录名与 frontmatter 的 name 不一致就跳过：官方 provider 也是这么
          // 裁决的，而一个"名字对不上"的技能点选后插进发送框的 `/名字` 加载不到。
          if (entry !== undefined && entry.name === name) out.push(entry)
        }
        out.sort((a, b) => a.name.localeCompare(b.name))
        return out
      } catch {
        return []
      }
    },
    async get(candidate, opts) {
      try {
        if (opts?.signal?.aborted === true) throw opts.signal.reason
        const located = candidate?.locator?.path ?? candidate?.path
        if (typeof located !== 'string' || located === '') return undefined
        const entryPath = located
        let info
        try {
          info = await stat(entryPath)
        } catch {
          return undefined
        }
        if (!info.isFile()) return undefined
        let content
        try {
          content = await readFile(entryPath, 'utf8')
        } catch {
          return undefined
        }
        const parsed = parseSkill(content)
        if (parsed === undefined) return undefined
        if (candidate?.name !== undefined && parsed.name !== candidate.name) return undefined
        const skillDir = path.dirname(entryPath)
        return {
          name: parsed.name,
          description: parsed.description,
          invocation: { modelInvocable: true, userInvocable: true },
          source: 'bundled',
          provider: PROVIDER_NAME,
          resourceBase: { kind: 'directory', path: skillDir },
          path: entryPath,
          content: parsed.body,
        }
      } catch {
        return undefined
      }
    },
  }
}

/**
 * 把随包技能注册进 `skills` 服务（若它存在）。返回 dispose，或 undefined。
 *
 * @param ctx - 插件上下文；只用 `ctx.get('skills')`，不写进 `inject`
 *   （一个 peer 服务缺失不该让整个插件加载失败）。
 * @param log - 可选日志函数（`console.log` 形态）。
 */
export function registerBundledSkills(ctx, log = console.log) {
  try {
    const skills = ctx?.get?.('skills')
    if (skills === undefined || typeof skills.registerProvider !== 'function') {
      // 内核没有 skills 服务：随包技能自然不可见，插件其余功能照常。
      return undefined
    }
    const dispose = skills.registerProvider(createBundledSkillProvider)
    try {
      log(`[dsh-skill-catalog] bundled skill provider registered (rank ${BUNDLED_RANK})`)
    } catch {
      /* logging is never a requirement */
    }
    return typeof dispose === 'function' ? dispose : undefined
  } catch (error) {
    try {
      console.warn('[dsh-skill-catalog] bundled skill provider registration failed:', error?.message ?? error)
    } catch {
      /* ignore */
    }
    return undefined
  }
}
