/**
 * `src/presets.js` 的离线回归 —— 不需要 DSH、不需要网络。
 *
 * 这里钉住的是「哪些技能会被遮住」这套判断：未绑定任务不限制、绑了只放行名单、
 * 改预设立即改名单、解绑全放行、目录大小写/分隔符归一后算同一个任务、删预设后
 * 绑定随之消失。真正往 `agent.ctx` 注册影子那一步由 host 侧运行时自检兜底（见
 * `syncAgentSkills` 里的 `verified` 分支），此处用 mock 的 skills 服务代替。
 *
 *   node scripts/test-presets.mjs
 */

import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const home = await mkdtemp(path.join(os.tmpdir(), 'dsh-presets-'))
process.env.DSH_HOME = home

const {
  bindPreset,
  deletePreset,
  normalizeCwd,
  presetIdForCwd,
  readPresets,
  resolvePreset,
  savePreset,
  syncAgentSkills,
  taskCwdOf,
} = await import('../src/presets.js')

const CATALOG = ['alpha', 'beta', 'gamma']

/** 任务目录（真实存在，好让 realpath 归一有东西可解析）。 */
const taskA = path.join(home, 'work', 'task-a')
const taskB = path.join(home, 'work', 'task-b')
await mkdir(taskA, { recursive: true })
await mkdir(taskB, { recursive: true })

/** 一个 mock agent：skills 服务按「影子是否已注册」返回对应 invocation。 */
function makeAgent(cwd) {
  const shadows = new Set()
  const registerCalls = []
  const agent = {
    session: { header: { cwd } },
    ctx: {
      skills: {
        async snapshot() {
          return {
            complete: true,
            skills: CATALOG.map((name) => ({
              name,
              description: name,
              invocation: { modelInvocable: !shadows.has(name), userInvocable: !shadows.has(name) },
            })),
          }
        },
        register(skill) {
          registerCalls.push(skill.name)
          shadows.add(skill.name)
          return () => shadows.delete(skill.name)
        },
      },
    },
    __shadows: shadows,
    __calls: registerCalls,
  }
  return agent
}

const ctx = { workingDirectory: { async ensure() { return taskA } }, logger: { warn() {} } }
const signal = new AbortController().signal

// 1. 没有绑定 = 默认预设「不限制」：一个影子都不注册。
{
  const agent = makeAgent(taskA)
  const result = await syncAgentSkills(ctx, agent, signal)
  assert.equal(result.applied, false)
  assert.equal(agent.__calls.length, 0, '没绑预设的任务不该被动过')
  console.log('1. 未绑定任务 → 不限制，零注册 ✓')
}

// 2. 绑预设后，只放行名单内的，其余全遮。
{
  const saved = await savePreset({ name: '开发', skills: ['alpha'] })
  await bindPreset(taskA, saved.preset.id)
  const agent = makeAgent(taskA)
  const result = await syncAgentSkills(ctx, agent, signal)
  assert.equal(result.applied, true)
  assert.deepEqual(agent.__calls.sort(), ['beta', 'gamma'])
  console.log('2. 绑「开发」[alpha] → beta+gamma 被遮 ✓')
}

// 3. 同一步重跑幂等（不会每步都重注册）。
{
  const agent = makeAgent(taskA)
  await syncAgentSkills(ctx, agent, signal)
  const first = agent.__calls.length
  const again = await syncAgentSkills(ctx, agent, signal)
  assert.equal(again.applied, false)
  assert.equal(agent.__calls.length, first, '稳定的一步不该重新注册')
  console.log('3. 重复调用是空操作 ✓')
}

// 4. 改预设立即改名单（这就是「跟着变」）。
{
  const agent = makeAgent(taskA)
  await syncAgentSkills(ctx, agent, signal)
  const before = new Set(agent.__shadows)
  const bound = await resolvePreset(taskA)
  await savePreset({ id: bound.id, name: '开发', skills: ['alpha', 'beta'] })
  const result = await syncAgentSkills(ctx, agent, signal)
  assert.equal(result.applied, true)
  assert.deepEqual([...agent.__shadows], ['gamma'], 'beta 被放行后影子必须撤掉')
  assert.equal(before.has('gamma'), true)
  console.log('4. 改预设 → 下一步名单跟着变 ✓')
}

// 5. 空名单 = 这个任务一个技能都不给。
{
  const blank = await savePreset({ name: '空白', skills: [] })
  await bindPreset(taskB, blank.preset.id)
  const agent = makeAgent(taskB)
  await syncAgentSkills(ctx, agent, signal)
  assert.deepEqual([...agent.__shadows].sort(), ['alpha', 'beta', 'gamma'])
  console.log('5. 空名单 → 全部遮蔽 ✓')
}

// 6. 目录写法不同（大小写 / 尾斜杠）算同一个任务。
{
  const variant = process.platform === 'win32'
    ? `${taskA.toUpperCase()}${path.sep}`
    : `${taskA}${path.sep}`
  assert.equal(normalizeCwd(variant), normalizeCwd(taskA))
  assert.equal(await presetIdForCwd(variant), await presetIdForCwd(taskA))
  console.log('6. 路径归一：大小写 / 尾分隔符 视为同一任务 ✓')
}

// 7. 解绑 = 回到默认预设，影子全撤。
{
  await bindPreset(taskA, null)
  const agent = makeAgent(taskA)
  await syncAgentSkills(ctx, agent, signal)
  assert.equal((await resolvePreset(taskA)), undefined)
  assert.equal(agent.__calls.length, 0)
  console.log('7. 解绑 → 回到不限制 ✓')
}

// 8. 删预设：绑定随之消失，任务回落默认。
{
  const doomed = await savePreset({ name: '临时', skills: ['alpha'] })
  await bindPreset(taskB, doomed.preset.id)
  const removed = await deletePreset(doomed.preset.id)
  assert.equal(removed.affected.length, 1, '应报告 1 个受影响任务')
  assert.equal(await presetIdForCwd(taskB), null)
  const agent = makeAgent(taskB)
  await syncAgentSkills(ctx, agent, signal)
  assert.equal(agent.__calls.length, 0, '删预设后不应还遮着什么')
  console.log('8. 删预设 → 绑定清空、任务回落不限制 ✓')
}

// 9. 指向不存在预设的绑定，读出来就被丢掉（回落到默认）。
{
  const doc = await readPresets()
  doc.bindings[normalizeCwd(taskB)] = 'not-a-real-preset'
  await (await import('node:fs/promises')).writeFile(
    path.join(home, 'dsh-skill-catalog-presets.json'),
    JSON.stringify(doc),
    'utf8',
  )
  assert.equal(await presetIdForCwd(taskB), null)
  console.log('9. 悬空绑定被丢弃 ✓')
}

// 10. 没有会话 cwd 的 agent 直接跳过，绝不抛。
{
  const agent = { session: {}, ctx: {} }
  const result = await syncAgentSkills(ctx, agent, signal)
  assert.equal(result.applied, false)
  assert.equal(taskCwdOf(agent), undefined)
  console.log('10. 缺 cwd / 缺 skills 服务 → 跳过 ✓')
}

// 11. taskCwdOf 只认会话原始 cwd，不认「当前工作目录」。
{
  assert.equal(taskCwdOf({ session: { header: { cwd: '/x' }, cwd: '/current' } }), '/x')
  assert.equal(taskCwdOf({ session: { cwd: '/only-session' } }), '/only-session')
  console.log('11. 任务身份 = header.cwd（不是当前目录）✓')
}

await rm(home, { recursive: true, force: true })
console.log('\nall presets checks passed')
