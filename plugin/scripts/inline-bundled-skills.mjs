/**
 * 把 src/bundled-skills.js 内联进编译产物 lib/index.js。
 *
 * 与 inline-categories.mjs 同理：安装包里 build.mjs 被裁、esbuild 未装，
 * 无法重新打包；lib/index.js 才是宿主实际加载的文件。
 *
 * lib/index.js 是 ESM 产物（顶部有 import、底部有 export{}），所以内联必须
 * **先剥掉 import**，并把 `import.meta.url` 换成 `new URL('./x', import.meta.url)`
 * 之外的等价写法 —— 这里直接改用 lib 目录下的相对定位，避免 import.meta 在
 * 内联上下文里的歧义。
 *
 * 幂等：目标标识符已存在就跳过。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const libPath = 'E:/agent work/skill管理插件/plugin/lib/index.js'
const srcPath = 'E:/agent work/skill管理插件/plugin/src/bundled-skills.js'

let code = readFileSync(libPath, 'utf8')
let source = readFileSync(srcPath, 'utf8')

if (code.includes('function createBundledSkillProvider()')) {
  console.log('skipped: already inlined')
  process.exit(0)
}

// 1) 剥 import 行，改写成本文件已有的别名（lib/index.js 顶部已 import 过这些）
source = source
  .replace(/^import \{[^}]*\} from 'node:fs\/promises'\r?\n/m, '')
  .replace(/^import path from 'node:path'\r?\n/m, '')
  .replace(/^import \{ fileURLToPath \} from 'node:url'\r?\n/m, '')
  .replace(/^import .*\r?\n/gm, '')
  // import.meta.url 在 ESM 的 lib/index.js 里同样可用，但没有 fileURLToPath，
  // 改用 URL + path 的等价写法。
  .replace(
    `function bundledDir() {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', BUNDLED_DIR_NAME)
}`,
    `function bundledDir() {
  return path4.join(new URL('../' + BUNDLED_DIR_NAME, import.meta.url).pathname.replace(/^\\/([A-Za-z]:)/, '$1'), '')
}`,
  )
  // 被剥掉 import 的模块里裸用 path → lib/index.js 的别名是 path4
  .replace(/\bpath\.join\(/g, 'path4.join(')
  .replace(/\bpath\.dirname\(/g, 'path4.dirname(')
  .replace(/^export function /gm, 'function ')
  .replace(/^export const /gm, 'const ')
  // lib/index.js 里已经有同名工具函数（frontmatterBlock 等），内联会撞名。
  // 给这一段全部加个前缀，宁可名字难看也不要跟既有实现纠缠。
  .replace(/\bfrontmatterBlock\b/g, 'bundledFrontmatterBlock')
  .replace(/\bparseSkill\b/g, 'parseBundledSkill')
  .replace(/\bisValidSkillName\b/g, 'isValidBundledSkillName')
  .replace(/\breadEntry\b/g, 'readBundledEntry')
  .replace(/\blistEntryNames\b/g, 'listBundledEntryNames')
  .replace(/\bbundledDir\b/g, 'bundledSkillsDir')
  .replace(/\bBUNDLED_DIR_NAME\b/g, 'BUNDLED_SKILLS_DIR_NAME')
  .trim()

// 2) 插在 apply 之前（apply 会调用 registerBundledSkills）。
// 编译产物里 JSDoc 被剥掉了，所以锚点必须是纯代码。
const anchor = `function apply(ctx) {
  ctx.effect(() => {
    const handler = async (req, res) => {`
if (!code.includes(anchor)) {
  console.error('FAILED: anchor not found')
  process.exit(1)
}

code = code.replace(
  anchor,
  `// src/bundled-skills.js（随包技能 provider，由本地补丁内联）
${source}

${anchor}`,
)

// 3) 在 apply 的末尾挂上注册调用
const tailAnchor = `  }, "dsh-skill-catalog: ui-skill self-heal patch");
}`
if (!code.includes(tailAnchor)) {
  console.error('FAILED: apply tail anchor not found')
  process.exit(1)
}
code = code.replace(
  tailAnchor,
  `  }, "dsh-skill-catalog: ui-skill self-heal patch");
  ctx.effect(() => {
    const dispose = registerBundledSkills(ctx);
    return () => {
      if (dispose !== void 0) {
        try {
          dispose();
        } catch {
        }
      }
    };
  }, "dsh-skill-catalog: bundled skills");
}`,
)

writeFileSync(libPath, code, 'utf8')
console.log('inlined src/bundled-skills.js into lib/index.js')
console.log('bytes:', code.length)
