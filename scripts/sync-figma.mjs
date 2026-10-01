// Pull every icon component under one Figma node (page / frame / section) into svg/
// and write a changeset describing what changed. Used by the "Sync icons from Figma" workflow.
//
// env: FIGMA_TOKEN (Personal access token, scope: file_content:read)
//      FIGMA_FILE_KEY  e.g. bZb2X6TMQdBSaeJPUcLsga
//      FIGMA_ICONS_NODE  node id of the Icons page/frame, e.g. 123:456  (from ?node-id=123-456)
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'

const { FIGMA_TOKEN, FIGMA_FILE_KEY, FIGMA_ICONS_NODE } = process.env
if (!FIGMA_TOKEN || !FIGMA_FILE_KEY || !FIGMA_ICONS_NODE) {
  console.error('ต้องตั้งค่า FIGMA_TOKEN, FIGMA_FILE_KEY และ FIGMA_ICONS_NODE'); process.exit(1)
}
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const SVG_DIR = new URL('../svg/', import.meta.url)
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const nodeId = FIGMA_ICONS_NODE.replace('-', ':')

async function figma(path) {
  const r = await fetch(`https://api.figma.com/v1/${path}`, { headers: { 'X-Figma-Token': FIGMA_TOKEN } })
  if (!r.ok) throw new Error(`Figma API ${r.status}: ${await r.text()}`)
  return r.json()
}

// 1) walk the node tree and collect standalone components (skip variants inside component sets)
const { nodes } = await figma(`files/${FIGMA_FILE_KEY}/nodes?ids=${encodeURIComponent(nodeId)}`)
const root = nodes[nodeId]?.document
if (!root) throw new Error(`ไม่พบ node ${nodeId} ในไฟล์`)
const comps = []
;(function walk(n) {
  if (n.type === 'COMPONENT') comps.push({ id: n.id, name: n.name.split('/').pop().trim() })
  if (n.type !== 'COMPONENT_SET' && n.children) n.children.forEach(walk)
})(root)

const bad = comps.filter(c => !NAME_RE.test(c.name))
if (bad.length) { console.error('ชื่อไม่เป็น kebab-case:', bad.map(c => c.name).join(', ')); process.exit(1) }
const dup = comps.map(c => c.name).filter((n, i, a) => a.indexOf(n) !== i)
if (dup.length) { console.error('ชื่อซ้ำ:', [...new Set(dup)].join(', ')); process.exit(1) }

// 2) ask Figma to render SVGs (batches of 100 ids)
await mkdir(SVG_DIR, { recursive: true })
const existing = new Set((await readdir(SVG_DIR)).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4)))
const added = [], updated = []
for (let i = 0; i < comps.length; i += 100) {
  const batch = comps.slice(i, i + 100)
  const { images } = await figma(`images/${FIGMA_FILE_KEY}?format=svg&svg_outline_text=true&ids=${batch.map(c => encodeURIComponent(c.id)).join(',')}`)
  for (const c of batch) {
    if (!images[c.id]) { console.warn(`ข้าม ${c.name}: Figma ไม่ส่ง SVG กลับมา`); continue }
    const svg = await (await fetch(images[c.id])).text()
    const file = new URL(`${c.name}.svg`, SVG_DIR)
    const before = existing.has(c.name) ? await readFile(file, 'utf8') : null
    if (before === svg) continue
    await writeFile(file, svg)
    ;(before === null ? added : updated).push(c.name)
  }
}

// 3) changeset: new icons → minor, redrawn icons → patch (removals are done by hand → major)
if (!added.length && !updated.length) { console.log('ไม่มีไอคอนเปลี่ยนแปลง'); process.exit(0) }
const lines = [added.length && `เพิ่มไอคอน: ${added.join(', ')}`, updated.length && `อัปเดตไอคอน: ${updated.join(', ')}`].filter(Boolean)
await writeFile(new URL(`../.changeset/figma-sync-${Date.now()}.md`, import.meta.url),
  `---\n"${pkg.name}": ${added.length ? 'minor' : 'patch'}\n---\n\n${lines.join('\n')}\n`)
console.log(lines.join('\n'))
