// 构建解析脚本：扫描 notes/ 笔记库 与 custom-pages/ 自定义页面，
// 输出：
//   src/data/site-manifest.json     目录树 / 图谱节点边 / 标签 / 页面清单
//   src/data/notes/<slug>.json      每篇正文（懒加载）+ 大纲 + 反向链接
//   public/notes-assets/<name>      笔记引用的图片资源
// 用法：npm run parse
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const notesDir = path.join(root, 'notes')
const pagesDir = path.join(root, 'custom-pages')
const dataDir = path.join(root, 'src', 'data')
const noteOutDir = path.join(dataDir, 'notes')
const assetOutDir = path.join(root, 'public', 'notes-assets')

const IMAGE_EXT = /\.(png|jpe?g|gif|svg|webp|bmp)$/i

function walk(dir, ext = '') {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '.obsidian' || entry.name === '.git') continue
      out.push(...walk(full, ext))
    } else if (entry.name.endsWith(ext)) out.push(full)
  }
  return out
}

// 剥离代码块与行内代码，避免把代码里的 #、[[ ]] 当成笔记标签 / 双链
function stripCode(text) {
  return text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '')
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
  let currentKey = null
  for (const line of m[1].split(/\r?\n/)) {
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
      fm[key] = raw.trim() ? splitInlineArray(raw) : []
    } else {
      fm[key] = raw.replace(/^["']|["']$/g, '').trim()
    }
  }
  return fm
}

function toSlug(rel) {
  return rel.replace(/\.md$/, '').replace(/[\\/]/g, '-')
}

// 文件名安全化（用于 src/data/notes/*.json）
function toFileName(slug) {
  return slug.replace(/[^\w\u4e00-\u9fa5.-]/g, '_')
}

function extractInlineTags(text) {
  const tags = new Set()
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*#{1,6}\s/.test(line)) continue
    const re = /(^|[\s>])#([A-Za-z0-9一-龥_/-]+)/g
    let mm
    while ((mm = re.exec(line))) {
      const tag = mm[2].replace(/[\/]+$/, '')
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

function extractHeadings(text) {
  const out = []
  text.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^(#{1,6})\s+(.+)$/)
    if (!m) return
    out.push({ level: m[1].length, text: m[2].replace(/\s*#+\s*$/, '').trim() })
  })
  return out
}

function copyAssets(files) {
  fs.rmSync(assetOutDir, { recursive: true, force: true })
  fs.mkdirSync(assetOutDir, { recursive: true })
  const index = {}
  for (const full of files) {
    const name = path.basename(full)
    if (index[name]) continue
    fs.copyFileSync(full, path.join(assetOutDir, name))
    index[name] = true
  }
  return index
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
    const body = fmMatch ? raw.slice(fmMatch[0].length) : raw
    const codeFree = stripCode(body)
    const fileName = path.basename(rel, '.md')
    const title = fm.title || fileName
    const slug = toSlug(rel)
    const file = toFileName(slug)

    const links = extractLinks(codeFree).filter((t) => {
      if (IMAGE_EXT.test(t)) return false
      if (t.split(/[\\/]/).some((seg) => seg.startsWith('_'))) return false
      return true
    })
    const images = extractLinks(body).filter((t) => IMAGE_EXT.test(t))
    const inlineTags = extractInlineTags(codeFree)
    const tags = [...new Set([...(fm.tags || []), ...inlineTags])]

    for (const t of tags) tagMap.set(t, (tagMap.get(t) || 0) + 1)
    for (const target of links) edges.push({ source: slug, target })

    // 字数（去空白、去 md 标记）与阅读时长估算 400 字/分钟；时间取源文件 mtime
    const plain = stripCode(body)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
      .replace(/^[#>*\-\s]+/gm, '')
      .replace(/\s+/g, '')
    const chars = plain.length
    const mtime = fs.statSync(full).mtime.toISOString()

    notes.push({
      slug,
      rel,
      file,
      title,
      tags,
      aliases: fm.aliases || [],
      links,
      images,
      chars,
      minutes: Math.max(1, Math.round(chars / 400)),
      mtime,
      headings: extractHeadings(body),
      content: body.replace(/^\s+/, ''),
    })
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

  // 双链 / 反向链接解析（与前端 graph.js 规则一致）
  const bySlug = new Map(notes.map((n) => [n.slug, n]))
  const byBase = new Map(notes.map((n) => [n.rel.replace(/\.md$/, '').split(/[\\/]/).pop(), n.slug]))
  const byTitle = new Map(notes.map((n) => [n.title.toLowerCase(), n.slug]))
  const byAlias = new Map()
  for (const n of notes) for (const a of n.aliases) byAlias.set(a.toLowerCase(), n.slug)

  const resolve = (target) => {
    const t = target.trim().replace(/\.md$/, '')
    const slug = t.replace(/[\\/]/g, '-')
    const base = t.split(/[\\/]/).pop()
    if (bySlug.has(t)) return t
    if (bySlug.has(slug)) return slug
    return byBase.get(base) || byTitle.get(t.toLowerCase()) || byAlias.get(t.toLowerCase()) || null
  }

  const backlinks = new Map()
  for (const e of edges) {
    const src = bySlug.has(e.source) ? e.source : resolve(e.source)
    const tgt = resolve(e.target)
    if (!src || !tgt || src === tgt) continue
    if (!backlinks.has(tgt)) backlinks.set(tgt, new Set())
    backlinks.get(tgt).add(src)
  }

  const assets = copyAssets(walk(notesDir).filter((f) => IMAGE_EXT.test(f)))

  // 自定义页 HTML 同步到 public/custom-pages/，供站点内 iframe 与新窗口直接打开
  const pagesPublicDir = path.join(root, 'public', 'custom-pages')
  fs.rmSync(pagesPublicDir, { recursive: true, force: true })
  fs.mkdirSync(pagesPublicDir, { recursive: true })
  for (const f of fs.readdirSync(pagesDir).filter((f) => f.endsWith('.html') && !f.startsWith('_'))) {
    fs.copyFileSync(path.join(pagesDir, f), path.join(pagesPublicDir, f))
  }

  fs.rmSync(noteOutDir, { recursive: true, force: true })
  fs.mkdirSync(noteOutDir, { recursive: true })
  for (const n of notes) {
    const payload = {
      slug: n.slug,
      title: n.title,
      rel: n.rel,
      tags: n.tags,
      aliases: n.aliases,
      chars: n.chars,
      minutes: n.minutes,
      mtime: n.mtime,
      headings: n.headings,
      backlinks: [...(backlinks.get(n.slug) || [])].map((s) => ({
        slug: s,
        title: bySlug.get(s)?.title || s,
      })),
      content: n.content,
    }
    fs.writeFileSync(path.join(noteOutDir, `${n.file}.json`), JSON.stringify(payload))
  }

  const manifest = {
    notes: notes.map(({ content, headings, images, ...rest }) => rest),
    edges,
    tags,
    customPages,
    assetCount: Object.keys(assets).length,
    generatedAt: new Date().toISOString(),
  }
  fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(path.join(dataDir, 'site-manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(
    `[parse] notes=${notes.length} edges=${edges.length} tags=${tags.length} pages=${customPages.length} assets=${manifest.assetCount}`
  )
}

main()
