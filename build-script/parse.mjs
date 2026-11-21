// 构建解析脚本：扫描 notes/ 笔记库 与 custom-pages/ 自定义页面，
// 输出 src/data/site-manifest.json，供前端生成目录树 / 图谱节点边 / 标签 / 页面清单。
// 用法：npm run parse
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const notesDir = path.join(root, 'notes')
const pagesDir = path.join(root, 'custom-pages')
const outDir = path.join(root, 'src', 'data')

function walk(dir, ext) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full, ext))
    else if (entry.name.endsWith(ext)) out.push(full)
  }
  return out
}

// 剥离代码块与行内代码，避免把代码里的 #、[[ ]] 当成笔记标签 / 双链
function stripCode(text) {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
}

function splitInlineArray(raw) {
  return raw
    .replace(/^\[|\]$/g, '')
    .split(/[,，]/)
    .map((s) => s.replace(/^["']|["']$/g, '').trim())
    .filter(Boolean)
}

function parseFrontmatter(text) {
  const fm = { tags: [], aliases: [] }
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return fm
  const lines = m[1].split(/\r?\n/)
  let currentKey = null
  for (const line of lines) {
    const listItem = line.match(/^\s*-\s+(.*)$/)
    if (listItem && currentKey && (currentKey === 'tags' || currentKey === 'aliases')) {
      fm[currentKey].push(listItem[1].replace(/^["']|["']$/g, '').trim())
      continue
    }
    const kv = line.match(/^(\w+)\s*:\s*(.*)$/)
    if (!kv) continue
    const [, key, raw] = kv
    currentKey = key
    if (key === 'tags' || key === 'aliases') {
      if (raw.trim()) fm[key] = splitInlineArray(raw)
      else fm[key] = []
    } else {
      fm[key] = raw.replace(/^["']|["']$/g, '').trim()
    }
  }
  return fm
}

function toRelSlug(rel) {
  return rel.replace(/\.md$/, '').replace(/[\\/]/g, '-')
}

// 行内标签：行首/空白/引用符之后的 # 词；排除标题行（# 开头的 markdown 标题）
function extractInlineTags(text) {
  const tags = new Set()
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*#{1,6}\s/.test(line)) continue // 标题行
    const re = /(^|[\s>])#([A-Za-z0-9一-龥_/-]+)/g
    let mm
    while ((mm = re.exec(line))) {
      let tag = mm[2].replace(/[\/]+$/, '')
      if (tag) tags.add(tag)
    }
  }
  return [...tags]
}

function extractLinks(text) {
  const re = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]+)?\]\]/g
  const links = []
  let mm
  while ((mm = re.exec(text))) links.push(mm[1].trim())
  return links
}

function parseNotes() {
  const files = walk(notesDir, '.md')
  const notes = []
  const edges = []
  const tagMap = new Map()

  for (const full of files) {
    const rel = path.relative(notesDir, full).replace(/\\/g, '/')
    const raw = fs.readFileSync(full, 'utf8')
    const fm = parseFrontmatter(raw)
    const fmMatch = raw.match(/^---\r?\n[\s\S]*?\r?\n---/)
    const body = stripCode(fmMatch ? raw.slice(fmMatch[0].length) : raw)
    const h1 = (body.match(/^#\s+(.+)$/m) || [])[1]
    const fileName = path.basename(rel, '.md')
    const title = fm.title || fileName
    const slug = toRelSlug(rel)

    const links = extractLinks(body).filter((t) => {
      if (/\.(svg|png|jpe?g|gif|webp|pdf)$/i.test(t)) return false
      if (t.split(/[\\/]/).some((seg) => seg.startsWith('_'))) return false
      return true
    })
    const inlineTags = extractInlineTags(body)
    const tags = [...new Set([...(fm.tags || []), ...inlineTags])]

    for (const t of tags) tagMap.set(t, (tagMap.get(t) || 0) + 1)
    for (const target of links) edges.push({ source: slug, target })

    notes.push({ slug, rel, title, h1: h1 || '', tags, aliases: fm.aliases || [], links })
  }

  return { notes, edges, tags: [...tagMap.entries()].map(([name, count]) => ({ name, count })) }
}

function parseCustomPages() {
  if (!fs.existsSync(pagesDir)) return []
  return fs
    .readdirSync(pagesDir)
    .filter((f) => f.endsWith('.html') && !f.startsWith('_'))
    .map((f) => {
      const text = fs.readFileSync(path.join(pagesDir, f), 'utf8')
      const title = (text.match(/<title>([^<]*)<\/title>/) || [])[1] || f.replace(/\.html$/, '')
      return { file: f, slug: f.replace(/\.html$/, ''), title: title.trim() }
    })
}

function main() {
  const { notes, edges, tags } = parseNotes()
  const customPages = parseCustomPages()
  const manifest = { notes, edges, tags, customPages, generatedAt: new Date().toISOString() }
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'site-manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`[parse] notes=${notes.length} edges=${edges.length} tags=${tags.length} pages=${customPages.length}`)
}

main()
