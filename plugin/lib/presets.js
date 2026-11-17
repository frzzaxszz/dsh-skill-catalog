/**
 * 任务级技能预设（host 半）—— 决定「这个任务下的会话，模型能看见哪些 skill」。
 *
 * 三个概念：
 *
 *   - **任务**：侧边栏的一个工作区。它的身份是目录（`workspace.path`，对会话
 *     就是 `session.header.cwd`）。用目录当键而不是 workspaceId，是因为：
 *     任务改名只动 title、不动 path；而删除登记再加回同一目录会拿到新 UUID。
 *     更要紧的是**绝不能用「当前工作目录」**——模型可以用 `working_directory`
 *     切目录，subagent 的当前目录还可能是父会话下的子目录。
 *   - **预设**：一份技能名单**快照**。创建那一刻定了就定了，以后新装的技能不会
 *     自动进来（默认预设是例外，见下）。
 *   - **默认预设**：不是一份名单，而是「不限制」这个状态。没有绑定记录的任务
 *     都算它，所以新技能天然可用。
 *
 * 为什么这份配置能真的改变模型看到的东西：`@deepseek-ai/dsh-tool-skill` 渲染技能
 * 目录、处理 `skill` 工具调用、注入 `/名字` 手势时，都用 `scope: agent` 查技能
 * 注册表；注册表合并「全局层 → preset 层 → 本 agent 层」时**最近层同名者直接
 * 胜出**。于是我们在 `agent.ctx` 里给「不在名单内」的技能注册一个同名影子条目
 * （两个 invocation 都关掉），就能同时做到：
 *
 *   - 模型目录不再列出它（`isModelInvocable` 过滤掉影子）；
 *   - `skill` 工具报 `not available for model invocation`；
 *   - `/名字` 手势静默跳过（`isUserInvocable` 为假）。
 *
 * 这是用内核自己的可见性规则拦的，不是只在面板里藏行。
 *
 * 存储是**独立文件**（与置顶/使用记录那份分开）：那份有严格的规范化器，会把
 * 未知字段丢掉，塞在一起总有一边会丢数据。
 *
 * @module dsh-skill-catalog/presets
 */

import { mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/**
 * 解析 `$DSH_HOME`，不 import patch-ui-skill.js。
 *
 * 故意重复这几行：本模块在 `lib/` 下必须以独立文件原样存在（那边的 host 半是
 * 内联 bundle，磁盘上没有 patch-ui-skill.js），所以保持无依赖才能让两份副本
 * 逐字相同。
 */
function dshHome() {
  return process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh')
}

/** 预设库文件的绝对路径。 */
export function presetsFile() {
  return path.join(dshHome(), 'dsh-skill-catalog-presets.json')
}

/**
 * 把目录路径归一成可比较的键（去尾分隔符；Windows 再折小写）。
 *
 * 只做纯字符串处理，不做 I/O —— 解析归属时会被反复调用。
 */
export function normalizeCwd(cwd) {
  if (typeof cwd !== 'string' || cwd === '') return undefined
  let out = path.normalize(cwd)
  while (out.length > 1 && (out.endsWith(path.sep) || out.endsWith('/'))) out = out.slice(0, -1)
  return process.platform === 'win32' ? out.toLowerCase() : out
}

/** realpath 归一（目录不存在时回落到纯字符串归一），两侧用同一口径比较。 */
export async function canonicalCwd(cwd) {
  if (typeof cwd !== 'string' || cwd === '') return undefined
  try {
    return normalizeCwd(await realpath(cwd))
  } catch {
    return normalizeCwd(cwd)
  }
}

/** 生成一个稳定的预设 id（用户在 UI 里看到的是 name，id 只用于引用）。 */
export function newPresetId() {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** 把任意读到的值收成 `{ presets, bindings }`。 */
function normalizeDoc(value) {
  const source = value !== null && typeof value === 'object' ? value : {}
  const rawPresets = source.presets !== null && typeof source.presets === 'object' ? source.presets : {}
  const presets = {}
  for (const [id, entry] of Object.entries(rawPresets)) {
    if (typeof id !== 'string' || id === '') continue
    const record = entry !== null && typeof entry === 'object' ? entry : {}
    if (typeof record.name !== 'string' || record.name.trim() === '') continue
    const skills = Array.isArray(record.skills)
      ? [...new Set(record.skills.filter((name) => typeof name === 'string' && name !== ''))]
      : []
    presets[id] = {
      id,
      name: record.name.trim().slice(0, 80),
      skills,
      createdAt: Number.isFinite(record.createdAt) ? record.createdAt : 0,
      updatedAt: Number.isFinite(record.updatedAt) ? record.updatedAt : 0,
    }
  }
  const rawBindings = source.bindings !== null && typeof source.bindings === 'object' ? source.bindings : {}
  const bindings = {}
  for (const [cwd, presetId] of Object.entries(rawBindings)) {
    const key = normalizeCwd(cwd)
    if (key === undefined || typeof presetId !== 'string') continue
    // 指向已不存在的预设的绑定，等于没有绑定（回落到默认预设）。
    if (presets[presetId] === undefined) continue
    bindings[key] = presetId
  }
  return { presets, bindings }
}

/** 读整个预设库；文件不存在或损坏时返回空库。 */
export async function readPresets() {
  try {
    return normalizeDoc(JSON.parse(await readFile(presetsFile(), 'utf8')))
  } catch {
    return { presets: {}, bindings: {} }
  }
}

/** 原子写回整个预设库（临时文件 + rename），返回规范化后的结果。 */
async function writePresets(doc) {
  const normal = normalizeDoc(doc)
  const file = presetsFile()
  await mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  await writeFile(tmp, `${JSON.stringify(normal, null, 2)}\n`, 'utf8')
  await rename(tmp, file)
  return normal
}

/**
 * 新建或更新一个预设。
 *
 * @param preset - `{ id?, name, skills }`；省略 id 即新建。
 * @returns 保存后的预设与整库快照。
 */
export async function savePreset(preset) {
  const doc = await readPresets()
  const now = Date.now()
  const id = typeof preset?.id === 'string' && preset.id !== '' ? preset.id : newPresetId()
  const name = typeof preset?.name === 'string' ? preset.name.trim() : ''
  if (name === '') throw new Error('预设需要一个名字')
  const skills = Array.isArray(preset?.skills)
    ? [...new Set(preset.skills.filter((entry) => typeof entry === 'string' && entry !== ''))]
    : []
  const previous = doc.presets[id]
  doc.presets[id] = {
    id,
    name: name.slice(0, 80),
    skills,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  }
  const stored = await writePresets(doc)
  return { preset: stored.presets[id], ...stored }
}

/**
 * 删除一个预设。
 *
 * @returns `{ affected }` —— 被解绑的任务目录列表，调用方据此告知"影响 N 个任务"
 *   并让它们回落到默认预设。
 */
export async function deletePreset(id) {
  const doc = await readPresets()
  if (doc.presets[id] === undefined) throw new Error('这个预设不在了')
  delete doc.presets[id]
  const affected = Object.entries(doc.bindings)
    .filter(([, presetId]) => presetId === id)
    .map(([cwd]) => cwd)
  for (const cwd of affected) delete doc.bindings[cwd]
  const stored = await writePresets(doc)
  return { affected, ...stored }
}

/**
 * 把一个任务目录绑到某个预设，或解绑回默认。
 *
 * @param cwd - 任务目录（存进去前会 realpath 归一）。
 * @param presetId - 预设 id；传 `null` 即解绑。
 */
export async function bindPreset(cwd, presetId) {
  const key = await canonicalCwd(cwd)
  if (key === undefined) throw new Error('缺少任务目录')
  const doc = await readPresets()
  if (presetId === null) delete doc.bindings[key]
  else {
    if (doc.presets[presetId] === undefined) throw new Error('预设不存在')
    doc.bindings[key] = presetId
  }
  const stored = await writePresets(doc)
  return { cwd: key, bound: stored.bindings[key] ?? null, ...stored }
}

/**
 * 这个任务目录绑了哪个预设。
 *
 * @returns 命中的预设，或 `undefined`（= 默认预设「不限制」）。
 */
export async function resolvePreset(cwd) {
  const key = await canonicalCwd(cwd)
  if (key === undefined) return undefined
  const doc = await readPresets()
  const presetId = doc.bindings[key]
  return presetId === undefined ? undefined : doc.presets[presetId]
}

/**
 * 这个任务目录绑的预设 id，没绑返回 `null`。
 *
 * 给浏览器半用：路径归一化（realpath、Windows 折大小写）只在这里做一份，
 * 前端不必自己复现一遍规则。
 */
export async function presetIdForCwd(cwd) {
  const key = await canonicalCwd(cwd)
  if (key === undefined) return null
  const doc = await readPresets()
  return doc.bindings[key] ?? null
}

/** 从活 agent 身上取「任务目录」——必须是会话原始 cwd，不是当前工作目录。 */
export function taskCwdOf(agent) {
  const header = agent?.session?.header
  const cwd = header?.cwd ?? agent?.session?.cwd
  return typeof cwd === 'string' && cwd !== '' ? cwd : undefined
}

/** 每个 agent 已应用的状态，让稳定的一步只做一次字符串比较。 */
const agentStates = new WeakMap()

/**
 * 安全地记一条警告。
 *
 * 不能用 `ctx.logger`：Cordis 对「没在 inject 里声明过的服务」做属性访问会**直接抛
 * 错**（`cannot get property "logger" without inject`），而这里记日志的场合恰恰是
 * 出问题的时候 —— 记日志再抛一次错会把真正的失败原因盖掉。`ctx.get()` 只是拿不到
 * 就返回 undefined，不抛。
 */
function warn(ctx, message) {
  try {
    const logger = typeof ctx?.get === 'function' ? ctx.get('logger') : undefined
    if (logger !== undefined && typeof logger.warn === 'function') logger.warn(message)
    else console.warn(message)
  } catch {
    /* 记日志本身永远不能再升级成一次失败 */
  }
}

/** 释放某个 agent 上由本模块注册的全部影子。 */
function releaseShadows(state) {
  for (const disposer of state.disposers) {
    try {
      disposer()
    } catch {
      /* 层可能已经随 agent 一起销毁，没什么可撤的 */
    }
  }
  state.disposers = []
  state.hiddenKey = ''
}

/**
 * 让一个 agent 的技能目录与它所属任务的预设一致。
 *
 * 幂等且便宜：名单没变时只做一次字符串比较。由 `agent/pre-step` 调用，所以改
 * 预设后**下一个消息**就生效；万一影子落在这一步目录已经渲染完之后，注册表的
 * `skills/change` 仍会追加一份替换目录，过期的名字活不过这一步。
 *
 * 永不抛错：这里出问题不能把 agent 循环带崩。
 *
 * @param ctx - host 上下文（只用来取工作目录服务与 logger）。
 * @param agent - 活 agent；它的 `.ctx` 是 per-agent 作用域。
 * @param signal - 这一步的中止信号。
 * @returns `{ applied, hidden, reason? }`，供诊断与测试。
 */
export async function syncAgentSkills(ctx, agent, signal) {
  try {
    const cwd = taskCwdOf(agent)
    if (cwd === undefined) return { applied: false, hidden: 0, reason: 'no session cwd' }
    const scoped = agent?.ctx
    if (scoped?.skills === undefined || typeof scoped.skills.register !== 'function') {
      return { applied: false, hidden: 0, reason: 'agent scope has no skills service' }
    }

    let state = agentStates.get(agent)
    if (state === undefined) {
      state = { disposers: [], hiddenKey: '', verified: false }
      agentStates.set(agent, state)
    }

    const preset = await resolvePreset(cwd)
    if (preset === undefined) {
      // 默认预设 = 不限制：行为和没有这个功能时完全一样。
      if (state.disposers.length > 0) releaseShadows(state)
      return { applied: false, hidden: 0, reason: 'default preset' }
    }

    const allowed = new Set(preset.skills)
    const workingDirectory = typeof ctx?.get === 'function' ? ctx.get('workingDirectory') : undefined
    const projectCwd = workingDirectory === undefined
      ? undefined
      : await workingDirectory.ensure(agent, signal).catch(() => undefined)
    const snapshot = await scoped.skills.snapshot({ cwd: projectCwd, signal, scope: agent })
    const hidden = snapshot.skills.map((skill) => skill.name).filter((name) => !allowed.has(name))
    const hiddenKey = `${preset.id}\n${hidden.slice().sort().join('\n')}`

    if (hiddenKey === state.hiddenKey) return { applied: false, hidden: hidden.length }

    releaseShadows(state)
    for (const name of hidden) {
      try {
        const disposer = scoped.skills.register({
          name,
          description: `Disabled for this task by dsh-skill-catalog (${name}).`,
          invocation: { modelInvocable: false, userInvocable: false },
          content: '',
        })
        state.disposers.push(disposer)
      } catch (error) {
        // 同层已有同名 runtime 条目（罕见）：跳过这一个，别让它拖垮整次同步。
        warn(ctx, `[dsh-skill-catalog] shadow "${name}" refused: ${String(error?.message ?? error)}`)
      }
    }
    state.hiddenKey = hiddenKey

    // 每个 agent 验一次机制：万一上下文追踪不再把这些注册落进该 agent 自己的层，
    // 面板不能声称一个模型根本看不到的限制。
    //
    // 判断看的是 `invocation`，不是"名字还在不在"：影子同名，名字永远在。真正
    // 要成立的是「胜出的那个条目是我们的」（两个开关都关）。
    if (!state.verified && hidden.length > 0) {
      state.verified = true
      const check = await scoped.skills.snapshot({ cwd: projectCwd, signal, scope: agent }).catch(() => undefined)
      const unhidden = (check?.skills ?? []).filter(
        (skill) => hidden.includes(skill.name) && skill.invocation?.modelInvocable !== false,
      )
      if (unhidden.length > 0) {
        warn(ctx, 
          `[dsh-skill-catalog] per-task shadow did not take effect for ${unhidden.length} skill(s); `
          + 'the kernel scope mechanism may have changed',
        )
        return { applied: false, hidden: hidden.length, reason: 'shadow not visible in agent layer' }
      }
    }

    return { applied: true, hidden: hidden.length }
  } catch (error) {
    try {
      warn(ctx, `[dsh-skill-catalog] task preset sync failed: ${String(error?.message ?? error)}`)
    } catch {
      /* 记日志本身不能再升级成一次失败 */
    }
    return { applied: false, hidden: 0, reason: String(error?.message ?? error) }
  }
}
