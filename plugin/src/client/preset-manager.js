/**
 * dsh-skill-catalog — 任务级技能预设的编辑界面（挂在 ⚡ 面板的「预设」页签下）。
 *
 * 语义（与 host 侧 presets.js 一致）：
 *
 *   - 一个**任务**（侧边栏的工作区）绑一个**预设**；任务下所有会话共用它。
 *   - 预设是一份技能名单**快照**：创建那一刻定了就定了，后来新装的技能不会自动进来。
 *   - **默认（不限制）**不是名单，而是「什么都不拦」这个状态；没绑预设的任务都是它，
 *     所以新技能天然可用。
 *   - 改预设立即传导：所有绑它的任务下一个消息就按新名单走。
 *
 * 为什么写成 createElement 而不是 JSX：这个文件要**原样**粘进 lib/client.js（手维护
 * 的 esbuild bundle，仓库没有构建链）。技能列表与分类函数一律走 props，模块自身除
 * React 外零依赖，两份副本才能逐字相同。
 *
 * 所有失败都收敛到面板里的一行红字：客户端插件 apply 抛错会让整个 Web 壳起不来。
 *
 * @param React - 调用方注入的 React（bundle 里是 import_react.default）。
 * @returns 一个接收 `{ cwd, skills, categoryOf, categories }` 的组件。
 */
export function createPresetManager(React) {
  const h = React.createElement

  const CHIP = {
    padding: '3px 10px',
    borderRadius: '999px',
    border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.35))',
    background: 'transparent',
    color: 'inherit',
    fontSize: '12px',
    lineHeight: '18px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
  const CHIP_ON = {
    ...CHIP,
    borderColor: 'transparent',
    background: 'var(--dsw-alias-bg-accent, rgba(64,120,255,0.16))',
    fontWeight: 600,
  }
  const BTN = {
    padding: '4px 12px',
    borderRadius: '8px',
    border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.35))',
    background: 'transparent',
    color: 'inherit',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }

  const DEFAULT_ID = '__default__'

  async function getJson(url) {
    const response = await fetch(url, { method: 'GET' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload?.ok !== true) throw new Error(String(payload?.error ?? `HTTP ${response.status}`))
    return payload
  }

  async function postJson(body) {
    const response = await fetch('/dsh-skill-catalog/presets', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dsh-skill-catalog': '1' },
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload?.ok !== true) throw new Error(String(payload?.error ?? `HTTP ${response.status}`))
    return payload
  }

  return function PresetManager(props) {
    const cwd = typeof props?.cwd === 'string' ? props.cwd : ''
    const skills = Array.isArray(props?.skills) ? props.skills : []
    const categoryOf = typeof props?.categoryOf === 'function' ? props.categoryOf : () => ''
    // 分类按钮不要求调用方一定传 CATEGORIES：没传就按现有技能实际出现的分类推导，
    // 这样内联进 bundle 时不必把分类表再复制一份。
    const categories = Array.isArray(props?.categories) && props.categories.length > 0
      ? props.categories
      : [...new Set(skills.map((skill) => categoryOf(skill)).filter((key) => typeof key === 'string' && key !== ''))]
        .map((key) => ({ key }))

    const [loading, setLoading] = React.useState(true)
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState('')
    const [notice, setNotice] = React.useState('')
    const [presets, setPresets] = React.useState([])
    const [bindings, setBindings] = React.useState({})
    /** 当前任务绑的预设 id，`null` = 默认（不限制）。 */
    const [current, setCurrent] = React.useState(null)
    /** 正在编辑的预设：`{ id, name, skills: string[] }`，`id === null` 表示还没存过。 */
    const [draft, setDraft] = React.useState(null)
    const [query, setQuery] = React.useState('')
    const [confirmDelete, setConfirmDelete] = React.useState(false)
    const saveTimer = React.useRef(0)

    const load = React.useCallback(async () => {
      setLoading(true)
      setError('')
      try {
        const payload = await getJson(`/dsh-skill-catalog/presets?cwd=${encodeURIComponent(cwd)}`)
        setPresets(Array.isArray(payload.presets) ? payload.presets : [])
        setBindings(payload.bindings !== null && typeof payload.bindings === 'object' ? payload.bindings : {})
        setCurrent(typeof payload.current === 'string' ? payload.current : null)
      } catch (failure) {
        setError(String(failure?.message ?? failure))
      } finally {
        setLoading(false)
      }
    }, [cwd])

    React.useEffect(() => { void load() }, [load])
    React.useEffect(() => () => window.clearTimeout(saveTimer.current), [])

    const persist = React.useCallback(async (next) => {
      if (next === null || next.id === null) return
      setBusy(true)
      setError('')
      try {
        const payload = await postJson({
          action: 'save',
          preset: { id: next.id ?? undefined, name: next.name, skills: next.skills },
        })
        setPresets(Array.isArray(payload.presets) ? payload.presets : [])
        setBindings(payload.bindings !== null && typeof payload.bindings === 'object' ? payload.bindings : {})
      } catch (failure) {
        setError(String(failure?.message ?? failure))
      } finally {
        setBusy(false)
      }
    }, [])

    /** 还没写盘的改动：切到别的预设前必须先落盘，否则刚改的名字会静默丢失。 */
    const pendingRef = React.useRef(null)

    const flush = React.useCallback(async () => {
      window.clearTimeout(saveTimer.current)
      const pending = pendingRef.current
      pendingRef.current = null
      if (pending !== null) await persist(pending)
    }, [persist])

    /** 改动先落到本地，停顿一下再写盘（连续勾选不会打出十几个请求）。 */
    const edit = (next) => {
      setDraft(next)
      setNotice('')
      window.clearTimeout(saveTimer.current)
      pendingRef.current = next
      saveTimer.current = window.setTimeout(() => {
        pendingRef.current = null
        void persist(next)
      }, 600)
    }

    const selectPreset = (preset) => {
      void flush()
      setConfirmDelete(false)
      setQuery('')
      setDraft({ id: preset.id, name: preset.name, skills: [...preset.skills] })
    }

    const createPreset = async () => {
      await flush()
      setConfirmDelete(false)
      setQuery('')
      setBusy(true)
      setError('')
      try {
        const payload = await postJson({
          action: 'save',
          preset: { name: `新预设 ${presets.length + 1}`, skills: [] },
        })
        setPresets(Array.isArray(payload.presets) ? payload.presets : [])
        setBindings(payload.bindings !== null && typeof payload.bindings === 'object' ? payload.bindings : {})
        setDraft({ id: payload.preset.id, name: payload.preset.name, skills: [] })
      } catch (failure) {
        setError(String(failure?.message ?? failure))
      } finally {
        setBusy(false)
      }
    }

    const duplicatePreset = async () => {
      if (draft === null || draft.id === null) return
      await flush()
      setBusy(true)
      setError('')
      try {
        const payload = await postJson({
          action: 'save',
          preset: { name: `${draft.name} 副本`, skills: draft.skills },
        })
        setPresets(Array.isArray(payload.presets) ? payload.presets : [])
        setDraft({ id: payload.preset.id, name: payload.preset.name, skills: [...payload.preset.skills] })
        setNotice('已派生一份副本，它不再跟随原预设')
      } catch (failure) {
        setError(String(failure?.message ?? failure))
      } finally {
        setBusy(false)
      }
    }

    const affectedCount = draft === null || draft.id === null
      ? 0
      : Object.values(bindings).filter((id) => id === draft.id).length

    const removePreset = async () => {
      if (draft === null || draft.id === null) return
      await flush()
      setBusy(true)
      setError('')
      try {
        const payload = await postJson({ action: 'delete', id: draft.id })
        const affected = Array.isArray(payload.affected) ? payload.affected.length : 0
        setPresets(Array.isArray(payload.presets) ? payload.presets : [])
        setBindings(payload.bindings !== null && typeof payload.bindings === 'object' ? payload.bindings : {})
        setCurrent(null)
        setDraft(null)
        setConfirmDelete(false)
        setNotice(affected > 0 ? `预设已删除，${affected} 个任务回落到默认（不限制）` : '预设已删除')
      } catch (failure) {
        setError(String(failure?.message ?? failure))
      } finally {
        setBusy(false)
      }
    }

    const bindTask = async (presetId) => {
      if (cwd === '') {
        setError('拿不到当前任务的目录，无法绑定')
        return
      }
      setBusy(true)
      setError('')
      try {
        const payload = await postJson({ action: 'bind', cwd, presetId })
        setCurrent(typeof payload.bound === 'string' ? payload.bound : null)
        setBindings(payload.bindings !== null && typeof payload.bindings === 'object' ? payload.bindings : {})
        const target = presetId === null
          ? '这个任务已恢复为默认（不限制）'
          : `这个任务已绑定「${presets.find((p) => p.id === presetId)?.name ?? presetId}」`
        setNotice(`${target}，下一个消息起生效`)
      } catch (failure) {
        setError(String(failure?.message ?? failure))
      } finally {
        setBusy(false)
      }
    }

    const toggleSkill = (name) => {
      if (draft === null) return
      const set = new Set(draft.skills)
      if (set.has(name)) set.delete(name)
      else set.add(name)
      edit({ ...draft, skills: [...set] })
    }

    const addCategory = (key) => {
      if (draft === null) return
      const set = new Set(draft.skills)
      for (const skill of skills) {
        if (categoryOf(skill) === key) set.add(skill.name)
      }
      edit({ ...draft, skills: [...set] })
    }

    const dropCategory = (key) => {
      if (draft === null) return
      const drop = new Set(skills.filter((skill) => categoryOf(skill) === key).map((skill) => skill.name))
      edit({ ...draft, skills: draft.skills.filter((name) => !drop.has(name)) })
    }

    const labelOf = (presetId) => presets.find((preset) => preset.id === presetId)?.name ?? null
    const currentName = current === null ? null : labelOf(current)

    const visibleSkills = skills.filter((skill) => {
      if (query === '') return true
      const needle = query.toLowerCase()
      return skill.name.toLowerCase().includes(needle) || String(skill.description ?? '').toLowerCase().includes(needle)
    })

    return h('div', { style: { display: 'flex', flexDirection: 'column', minHeight: '0', flex: '1 1 auto' } },
      // 当前任务 + 绑定状态
      h('div', {
        style: {
          padding: '8px 14px',
          fontSize: '12px',
          opacity: 0.75,
          borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.12))',
        },
      }, currentName === null
        ? '当前任务：默认预设（不限制，全部技能可用）'
        : `当前任务：绑定「${currentName}」`),

      error !== '' && h('div', { style: { padding: '8px 14px', color: '#d1242f', fontSize: '12px' } }, error),
      notice !== '' && h('div', { style: { padding: '8px 14px', color: '#1a7f37', fontSize: '12px' } }, notice),

      // 预设 chips
      h('div', {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          padding: '10px 14px',
          borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.12))',
        },
      },
        h('button', {
          type: 'button',
          style: draft === null ? CHIP_ON : CHIP,
          onClick: () => { setDraft(null); setConfirmDelete(false); setNotice('') },
        }, '默认（不限制）'),
        presets.map((preset) => h('button', {
          key: preset.id,
          type: 'button',
          style: draft !== null && draft.id === preset.id ? CHIP_ON : CHIP,
          onClick: () => selectPreset(preset),
        }, `${preset.name}${preset.id === current ? ' ●' : ''}`)),
        h('button', {
          type: 'button',
          style: { ...CHIP, borderStyle: 'dashed' },
          disabled: busy,
          onClick: () => void createPreset(),
        }, '＋ 新建'),
      ),

      draft === null
        ? h('div', { style: { padding: '18px 14px', fontSize: '12px', opacity: 0.7 } },
          loading ? '读取中…' : '选一个预设来编辑，或「＋ 新建」。默认（不限制）不需要编辑 —— 它就是「什么都放行」。')
        : h('div', { style: { display: 'flex', flexDirection: 'column', minHeight: '0', flex: '1 1 auto' } },
          // 名字 + 操作
          h('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px 6px',
            },
          },
            h('input', {
              value: draft.name,
              onChange: (event) => edit({ ...draft, name: event.target.value }),
              placeholder: '预设名字',
              style: {
                flex: '1 1 auto',
                minWidth: '0',
                padding: '5px 9px',
                borderRadius: '8px',
                border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.35))',
                background: 'transparent',
                color: 'inherit',
                fontSize: '13px',
              },
            }),
            h('button', { type: 'button', style: BTN, disabled: busy, onClick: () => void duplicatePreset() }, '派生副本'),
            confirmDelete
              ? h('button', {
                type: 'button',
                style: { ...BTN, color: '#d1242f', borderColor: '#d1242f' },
                disabled: busy,
                onClick: () => void removePreset(),
              }, affectedCount > 0 ? `确认删除（影响 ${affectedCount} 个任务）` : '确认删除')
              : h('button', {
                type: 'button',
                style: BTN,
                disabled: busy,
                onClick: () => setConfirmDelete(true),
              }, '删除'),
          ),

          // 分类批量
          h('div', {
            style: { display: 'flex', flexWrap: 'wrap', gap: '5px', padding: '4px 14px 8px' },
          },
            h('span', { style: { fontSize: '11px', opacity: 0.6, alignSelf: 'center' } }, '按分类：'),
            categories.map((category) => h('button', {
              key: category.key,
              type: 'button',
              style: CHIP,
              disabled: busy,
              title: '点一下把这一类的技能全部加入；按住 Shift 点则整类移除',
              onClick: (event) => (event.shiftKey ? dropCategory(category.key) : addCategory(category.key)),
            }, category.key)),
          ),

          // 搜索
          h('div', { style: { padding: '0 14px 6px' } },
            h('input', {
              value: query,
              onChange: (event) => setQuery(event.target.value),
              placeholder: '筛选技能…',
              style: {
                width: '100%',
                boxSizing: 'border-box',
                padding: '5px 9px',
                borderRadius: '8px',
                border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.3))',
                background: 'transparent',
                color: 'inherit',
                fontSize: '12px',
              },
            }),
          ),

          // 技能勾选
          h('div', { style: { flex: '1 1 auto', overflowY: 'auto', minHeight: '80px', padding: '0 8px 6px' } },
            visibleSkills.length === 0
              ? h('div', { style: { padding: '18px', textAlign: 'center', fontSize: '12px', opacity: 0.7 } }, '没有匹配的技能')
              : visibleSkills.map((skill) => {
                const on = draft.skills.includes(skill.name)
                return h('label', {
                  key: skill.name,
                  style: {
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '9px',
                    padding: '6px 8px',
                    borderRadius: '8px',
                    cursor: busy ? 'default' : 'pointer',
                  },
                },
                  h('input', {
                    type: 'checkbox',
                    checked: on,
                    disabled: busy,
                    onChange: () => toggleSkill(skill.name),
                    style: { marginTop: '2px', flex: 'none' },
                  }),
                  h('div', { style: { minWidth: '0' } },
                    h('div', { style: { fontFamily: 'ui-monospace, monospace', fontSize: '12px' } }, skill.name),
                    skill.description !== undefined && String(skill.description) !== '' && h('div', {
                      style: {
                        fontSize: '11px',
                        opacity: 0.62,
                        marginTop: '1px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      },
                    }, String(skill.description)),
                  ),
                )
              }),
          ),

          // 绑定
          h('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 14px 12px',
              borderTop: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.18))',
            },
          },
            h('button', {
              type: 'button',
              style: { ...BTN, fontWeight: 600 },
              disabled: busy || draft.id === null,
              onClick: () => void bindTask(draft.id),
            }, current === draft.id ? '已绑定到当前任务' : '绑定到当前任务'),
            current !== null && h('button', {
              type: 'button',
              style: BTN,
              disabled: busy,
              onClick: () => void bindTask(null),
            }, '取消绑定'),
            h('div', { style: { marginLeft: 'auto', fontSize: '11px', opacity: 0.6 } },
              busy ? '保存中…' : `${draft.skills.length} / ${skills.length} 个技能`),
          ),
        ),
    )
  }
}
