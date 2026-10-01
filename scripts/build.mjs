// Build the icon package from svg/*.svg
//   1. validate every file (name, viewBox, no <text>/<image>)
//   2. optimize with SVGO and turn every colour into currentColor
//   3. write dist/icons.json (Iconify JSON), dist/index.mjs, dist/index.d.ts, dist/preview.html
// Exits with code 1 when any icon breaks the rules, so CI blocks the PR.
import { readFile, readdir, writeFile, mkdir, rm } from 'node:fs/promises'
import { optimize } from 'svgo'

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const PREFIX = pkg.iconPrefix || 'icon'
const SIZE = pkg.iconSize || 24
const SRC = new URL('../svg/', import.meta.url)
const OUT = new URL('../dist/', import.meta.url)
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
// attributes Figma puts on the root <svg> that the paths rely on (e.g. fill="none" for stroke icons)
const INHERITED = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']

const files = (await readdir(SRC)).filter(f => f.endsWith('.svg')).sort()
const icons = {}
const errors = []

for (const file of files) {
  const name = file.replace(/\.svg$/, '')
  const raw = await readFile(new URL(file, SRC), 'utf8')
  const problems = []
  if (!NAME_RE.test(name)) problems.push('ชื่อไฟล์ต้องเป็น kebab-case (a-z, 0-9, -)')
  if (!new RegExp(`viewBox="0 0 ${SIZE} ${SIZE}"`).test(raw)) problems.push(`viewBox ต้องเป็น "0 0 ${SIZE} ${SIZE}"`)
  if (/<text[\s>]/.test(raw)) problems.push('มี <text> — ให้ Outline ตัวอักษรใน Figma ก่อน')
  if (/<image[\s>]/.test(raw)) problems.push('มีรูปภาพ (<image>) อยู่ในไอคอน')
  if (problems.length) { errors.push([file, problems]); continue }

  const { data } = optimize(raw, {
    multipass: true,
    plugins: [
      'preset-default',
      'removeDimensions',
      { name: 'convertColors', params: { currentColor: true } },
      { name: 'removeAttrs', params: { attrs: ['class', 'data-.*'] } }
    ]
  })
  const root = data.match(/<svg([^>]*)>/)
  const attrs = Object.fromEntries([...root[1].matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]))
  let body = data.slice(root.index + root[0].length, data.lastIndexOf('</svg>')).trim()
  const keep = INHERITED.filter(a => attrs[a]).map(a => `${a}="${attrs[a]}"`)
  if (keep.length) body = `<g ${keep.join(' ')}>${body}</g>`
  icons[name] = { body }
}

if (errors.length) {
  console.error(`\n✖ ไอคอนไม่ผ่านกติกา ${errors.length} ไฟล์:`)
  for (const [f, p] of errors) console.error(`  - svg/${f}: ${p.join(', ')}`)
  process.exit(1)
}

const names = Object.keys(icons)
const collection = { prefix: PREFIX, width: SIZE, height: SIZE, lastModified: Math.floor(Date.now() / 1000), icons }

await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })
await writeFile(new URL('icons.json', OUT), JSON.stringify(collection))
await writeFile(new URL('index.mjs', OUT),
  `const collection = ${JSON.stringify(collection)};\nexport const iconNames = ${JSON.stringify(names)};\nexport const prefix = ${JSON.stringify(PREFIX)};\nexport default collection;\n`)
await writeFile(new URL('index.d.ts', OUT),
  `export type IconName = ${names.map(n => JSON.stringify(n)).join(' | ') || 'never'};\n` +
  `export type IconId = \`i-${PREFIX}-\${IconName}\`;\n` +
  `export declare const iconNames: IconName[];\nexport declare const prefix: ${JSON.stringify(PREFIX)};\n` +
  `declare const collection: { prefix: string; width: number; height: number; lastModified: number; icons: Record<IconName, { body: string }> };\n` +
  `export default collection;\n`)
await writeFile(new URL('preview.html', OUT), preview(names))
console.log(`✔ build สำเร็จ: ${names.length} ไอคอน → dist/ (prefix "${PREFIX}", เรียกใช้ i-${PREFIX}-<ชื่อ>)`)

function preview(list) {
  const tiles = list.map(n => `<button class="tile" data-name="${n}" title="คลิกเพื่อคัดลอก i-${PREFIX}-${n}">
<svg viewBox="0 0 ${SIZE} ${SIZE}" width="28" height="28" aria-hidden="true">${icons[n].body}</svg><span>${n}</span></button>`).join('\n')
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pkg.name} — ${list.length} icons</title><style>
:root{color-scheme:light dark;--bg:#fff;--fg:#0f172b;--muted:#62748e;--line:#e2e8f0;--hover:#f1f5f9}
@media (prefers-color-scheme:dark){:root{--bg:#0f172b;--fg:#f1f5f9;--muted:#90a1b9;--line:#314158;--hover:#1d293d}}
body{margin:0;font:14px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
header{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:16px 24px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
h1{font-size:18px;margin:0;flex:1}input{font:inherit;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:transparent;color:inherit;min-width:220px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;padding:24px}
.tile{all:unset;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 8px;border:1px solid var(--line);border-radius:10px;color:var(--fg)}
.tile:hover,.tile:focus-visible{background:var(--hover);outline:2px solid var(--muted)}.tile span{font-size:12px;color:var(--muted);word-break:break-all;text-align:center}
#toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--fg);color:var(--bg);padding:8px 14px;border-radius:999px;opacity:0;transition:opacity .2s}
#toast.on{opacity:1}</style></head><body>
<header><h1>${pkg.name} · ${list.length} ไอคอน · เรียกใช้ด้วย <code>i-${PREFIX}-ชื่อ</code></h1><input id="q" placeholder="ค้นหาไอคอน…" type="search"></header>
<main>${tiles}</main><div id="toast"></div><script>
const t=document.getElementById('toast');
document.querySelectorAll('.tile').forEach(b=>b.onclick=()=>{const v='i-${PREFIX}-'+b.dataset.name;navigator.clipboard?.writeText(v);t.textContent='คัดลอกแล้ว: '+v;t.classList.add('on');setTimeout(()=>t.classList.remove('on'),1200)});
document.getElementById('q').oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.tile').forEach(b=>b.hidden=!b.dataset.name.includes(q))};
</script></body></html>`
}
