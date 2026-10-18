/**
 * 把 categories 模块与分类筛选逻辑内联进编译产物 lib/client.js。
 *
 * 为什么必须手改：安装包里 build.mjs 被裁掉、esbuild 未安装，无法重新打包；
 * lib/client.js 才是 GUI 实际加载的文件（package.json exports 指向它）。
 *
 * 幂等：每个补丁先查标记是否已存在，已存在就跳过；锚点用字面量匹配，
 * 不做正则 —— 锚点里全是引号与反斜杠，正则化只会让失败变成静默。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const libPath = 'E:/agent work/skill管理插件/plugin/lib/client.js'
const inlinePath = 'E:/agent work/skill管理插件/plugin/src/client/categories.inline.js'

let code = readFileSync(libPath, 'utf8')
const inline = readFileSync(inlinePath, 'utf8').trim()

const applied = []
const skipped = []
const failed = []

/** 补丁表：name / marker（判断是否已打）/ anchor / replacement。 */
const PATCHES = [
  {
    name: 'inline-module',
    marker: 'const CATEGORY_MAP = {',
    anchor: `function zhDescription(skill) {
  const name = typeof skill?.name === 'string' ? skill.name : ''
  const zh = ZH_DESCRIPTIONS[name]
  if (typeof zh === 'string' && zh !== '') return zh
  return typeof skill?.description === 'string' ? skill.description : ''
}`,
    build: (anchor) => `${anchor}
// ── 技能分类表（显示层专用，由 dsh-skill-catalog 本地补丁内联）──────────
${inline}`,
  },
  {
    name: 'chip-styles',
    marker: 'function chipStyle(selected) {',
    anchor: `var listStyle = {
  overflowY: "auto",
  flex: "auto",
  padding: "0 6px 8px"
};`,
    build: (anchor) => `${anchor}
var chipRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  flex: "none",
  margin: "0 12px 6px 14px"
};
function chipStyle(selected) {
  return {
    flex: "none",
    padding: "2px 9px",
    borderRadius: "999px",
    border: "1px solid " + (selected ? "var(--dsw-alias-label-primary-bluish, #4cc9f0)" : "var(--dsw-alias-border-l1, rgba(128,128,128,0.35))"),
    background: selected ? "var(--dsw-alias-interactive-bg-active, rgba(128,128,128,0.16))" : "transparent",
    color: selected ? "var(--dsw-alias-label-primary-bluish, #4cc9f0)" : "var(--dsw-alias-label-tertiary, #8a94a6)",
    fontFamily: FONT_FAMILY,
    fontSize: "12px",
    lineHeight: "18px",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap"
  };
}`,
  },
  {
    name: 'state',
    marker: 'const [category, setCategory] = (0, import_react.useState)(CATEGORY_ALL);',
    anchor: `const [view, setView] = (0, import_react.useState)("all");`,
    build: (anchor) => `${anchor}
  const [category, setCategory] = (0, import_react.useState)(CATEGORY_ALL);`,
  },
  {
    name: 'toggle-reset',
    marker: 'setCategory(CATEGORY_ALL);',
    anchor: `      setView("all");`,
    build: (anchor) => `${anchor}
      setCategory(CATEGORY_ALL);`,
  },
  {
    name: 'derive',
    marker: 'const categoryMatched =',
    anchor: `const disabledNames = new Set(disabledSkills.map((skill) => skill.name));
  const groups = groupByPinned(
    (skills ?? []).filter((skill) => !disabledNames.has(skill.name)),
    usage,
    pinned
  );`,
    build: () => `const disabledNames = new Set(disabledSkills.map((skill) => skill.name));
  const shownSkills = (skills ?? []).filter((skill) => !disabledNames.has(skill.name));
  const categoryChips = categoriesPresent(shownSkills);
  const categoryMatched = category === CATEGORY_ALL ? shownSkills : shownSkills.filter((skill) => categoryOf(skill) === category);
  const groups = groupByPinned(categoryMatched, usage, pinned);`,
  },
  {
    name: 'active-reset',
    marker: '}, [query, category]);',
    anchor: `  }, [query]);`,
    build: () => `  }, [query, category]);`,
  },
  {
    name: 'render-chips',
    marker: 'style: chipRowStyle,',
    anchor: `import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: listStyle, children: view === "off" ?`,
    build: (anchor) => {
      const head = 'import_jsx_runtime.Fragment, { children: ['
      const tail = '\n          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: listStyle, children: view === "off" ?'
      const chips = `
          view !== "off" && categoryChips.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: chipRowStyle, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "span",
              {
                role: "button",
                tabIndex: -1,
                title: "\\u4E0D\\u7B5B\\u9009\\u5206\\u7C7B",
                onClick: () => setCategory(CATEGORY_ALL),
                style: chipStyle(category === CATEGORY_ALL),
                children: "\\u5168\\u90E8"
              }
            ),
            categoryChips.map((chip) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "span",
              {
                role: "button",
                tabIndex: -1,
                title: chip.hint === "" ? chip.full : chip.full + "\\u3000\\xB7\\u3000" + chip.hint,
                onClick: () => setCategory(category === chip.key ? CATEGORY_ALL : chip.key),
                style: chipStyle(category === chip.key),
                children: chip.key
              },
              chip.key
            ))
          ] }),`
      return `${head}${chips}${tail}`
    },
  },
  {
    name: 'empty-text',
    marker: '\\u8FD9\\u4E2A\\u5206\\u7C7B\\u4E0B\\u6CA1\\u6709\\u5339\\u914D\\u7684\\u6280\\u80FD',
    anchor: `/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: statusStyle, children: "\\u6CA1\\u6709\\u5339\\u914D\\u7684\\u6280\\u80FD" })`,
    build: () => `/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: statusStyle, children: category === CATEGORY_ALL ? "\\u6CA1\\u6709\\u5339\\u914D\\u7684\\u6280\\u80FD" : "\\u8FD9\\u4E2A\\u5206\\u7C7B\\u4E0B\\u6CA1\\u6709\\u5339\\u914D\\u7684\\u6280\\u80FD" })`,
  },
  {
    name: 'view-reset',
    // 这个 marker 必须靠「切视图语句紧跟着 setCategory」来判重。早先写成
    // `setCategory(CATEGORY_ALL);\n }}` 这种跨行拼法，一旦文件的换行风格不匹配就
    // 永远匹配不上，于是每次重跑都重复插入一行 —— lib 里就真的出现过两行一样的
    // setCategory。现在改成两个正则之一（CRLF / LF 都能认），彻底避开换行风格问题。
    markerRegex: /setView\(view === "off" \? "all" : "off"\);\r?\n\s+setCategory\(CATEGORY_ALL\);/,
    anchor: `                      setView(view === "off" ? "all" : "off");`,
    build: (anchor) => `${anchor}
                      setCategory(CATEGORY_ALL);`,
  },
]

for (const patch of PATCHES) {
  // marker 支持两种形态：正则可表达跨行 / 换行风格无关的情形，字符串用于普通片段。
  const already = patch.markerRegex !== undefined
    ? patch.markerRegex.test(code)
    : code.includes(patch.marker)
  if (already) {
    skipped.push(patch.name)
    continue
  }
  if (!code.includes(patch.anchor)) {
    failed.push(`${patch.name} —— 锚点未命中`)
    continue
  }
  code = code.replace(patch.anchor, patch.build(patch.anchor))
  applied.push(patch.name)
}

if (failed.length > 0) {
  console.error('FAILED:\n' + failed.join('\n'))
  process.exit(1)
}

writeFileSync(libPath, code, 'utf8')
console.log('applied:', applied.length ? applied.join(', ') : '(none)')
console.log('skipped:', skipped.length ? skipped.join(', ') : '(none)')
console.log('bytes:', code.length)
