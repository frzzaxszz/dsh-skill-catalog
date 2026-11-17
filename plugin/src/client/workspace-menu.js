/**
 * dsh-skill-catalog — 侧边栏**任务行**「…」菜单里的「技能预设」子菜单。
 *
 * 为什么走 `contextMenus` 而不是 slot：工作区行没有任何子 slot（`sidebar.workspaces`
 * 是 single kind，整块只能有一个占用者），而 `ctx.contextMenus.register({ target:
 * 'workspace' })` 是官方自己加工作区菜单项的通道 —— 官方 ui-open-in-app 就是这么
 * 往「…」里塞「在文件夹显示」的。`resolve` 每次打开菜单时重跑，所以菜单项文案能
 * 实时反映「这个任务现在绑的是哪个预设」。
 *
 * 子菜单（`children`）让「选预设」一步到位：点预设名即绑定，不需要再弹一层窗。
 * 点击带 `children` 的父项不会执行 `run`（官方菜单实现里明确 `return` 掉）。
 *
 * 纯 JS、无 JSX，可原样内联进 lib/client.js。
 *
 * @param ctx - 客户端插件上下文（要取 `ctx.contextMenus`）。
 * @returns 注销函数；`contextMenus` 不可用时返回一个空函数，绝不抛错。
 */
export function installWorkspacePresetMenu(ctx) {
  // ⚠️ 必须用 `ctx.get('contextMenus')`，**不要**写 `ctx.contextMenus`。
  //
  // Cordis 对「没在 inject 里声明过的服务」做属性访问时会**直接抛错**
  // （`cannot get property "contextMenus" without inject`），而不是返回 undefined。
  // 这个错误若发生在 `ctx.effect` 的 setup 阶段，插件 fiber 会永久停在 `loading`，
  // 前端启动审计于是整页启动失败：
  //     web boot: 1 entry did not activate
  //     dsh-skill-catalog: loading
  // 上一版就是死在这一行。`ctx.get()` 只是拿不到就返回 undefined，不会抛。
  // 同事参照 `bundled-skills.js` 的老做法（「只用 ctx.get('skills')，不写进 inject」）。
  const menus = typeof ctx?.get === 'function' ? ctx.get('contextMenus') : undefined
  if (menus === undefined || typeof menus.register !== 'function') {
    console.warn('[dsh-skill-catalog] contextMenus 不可用：任务行「技能预设」菜单未挂载')
    return () => {}
  }

  /** 读一次预设库；失败时降级为「只有默认」而不是报错。 */
  async function loadState(workspacePath, signal) {
    const url = `/dsh-skill-catalog/presets?cwd=${encodeURIComponent(workspacePath ?? '')}`
    const response = await fetch(url, { method: 'GET', signal })
    const payload = await response.json().catch(() => ({}))
    if (payload?.ok !== true) throw new Error(String(payload?.error ?? `HTTP ${response.status}`))
    return {
      presets: Array.isArray(payload.presets) ? payload.presets : [],
      current: typeof payload.current === 'string' ? payload.current : null,
    }
  }

  /** 写绑定；成功给一个 toast，失败也如实说。 */
  async function bindWorkspace(workspacePath, presetId, presetName) {
    try {
      const response = await fetch('/dsh-skill-catalog/presets', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-dsh-skill-catalog': '1' },
        body: JSON.stringify({ action: 'bind', cwd: workspacePath, presetId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (payload?.ok !== true) throw new Error(String(payload?.error ?? `HTTP ${response.status}`))
      const text = presetId === null
        ? '这个任务已恢复为默认（不限制）'
        : `这个任务已绑定「${presetName ?? presetId}」，下一个消息起生效`
      if (typeof menus.notify === 'function') menus.notify(text, true)
      else console.log('[dsh-skill-catalog]', text)
    } catch (error) {
      const text = `绑定失败：${String(error?.message ?? error)}`
      if (typeof menus.notify === 'function') menus.notify(text, false)
      else console.warn('[dsh-skill-catalog]', text)
    }
  }

  try {
    return menus.register({
      id: 'dsh-skill-catalog.workspace-preset',
      target: 'workspace',
      // 官方工作区菜单：rename 100 / reveal 200 / delete 300。夹在「打开」与「删除」
      // 之间，破坏性动作仍然排最后。
      order: 250,
      resolve: async (target, signal) => {
        const workspacePath = typeof target?.path === 'string' ? target.path : ''
        let state
        try {
          state = await loadState(workspacePath, signal)
        } catch (error) {
          return [{
            id: 'preset',
            label: `技能预设：读取失败`,
            disabled: true,
            failureLabel: String(error?.message ?? error),
          }]
        }
        signal?.throwIfAborted?.()

        const currentName = state.current === null
          ? null
          : state.presets.find((preset) => preset.id === state.current)?.name ?? null

        const children = [
          {
            id: 'default',
            label: '默认（不限制）',
            disabled: state.current === null,
            run: () => bindWorkspace(workspacePath, null),
          },
          ...state.presets.map((preset) => ({
            id: preset.id,
            label: `${preset.name}（${preset.skills.length} 个技能）`,
            disabled: preset.id === state.current,
            run: () => bindWorkspace(workspacePath, preset.id, preset.name),
          })),
        ]

        return [{
          id: 'preset',
          label: currentName === null ? '技能预设：默认（不限制）' : `技能预设：${currentName}`,
          children,
        }]
      },
    })
  } catch (error) {
    console.warn('[dsh-skill-catalog] 任务行菜单注册失败：', String(error?.message ?? error))
    return () => {}
  }
}
