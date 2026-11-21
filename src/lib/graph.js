// 由 site-manifest.json 构建图谱模型：节点、边、邻居、状态统计
// 只读站点：没有学习进度，所有节点统一按"未开始"处理
const STATUS_ORDER = ['not-started', 'learning', 'mastered']

export function normalizeStatus() {
  return 'not-started'
}

// 把 [[链接目标]]（路径 / 标题 / 别名 / slug）解析到节点 id
function buildResolver(notes) {
  const bySlug = new Map()
  const byBasename = new Map()
  const byTitle = new Map()
  const byAlias = new Map()

  for (const n of notes) {
    bySlug.set(n.slug, n.slug)
    const base = n.rel.replace(/\.md$/, '').split(/[\\/]/).pop()
    byBasename.set(base, n.slug)
    byTitle.set(n.title.toLowerCase(), n.slug)
    for (const a of n.aliases || []) byAlias.set(a.toLowerCase(), n.slug)
  }

  return (target) => {
    const t = target.trim().replace(/\.md$/, '')
    const lower = t.toLowerCase()
    const slug = t.replace(/[\\/]/g, '-')
    const base = t.split(/[\\/]/).pop()
    return (
      bySlug.get(t) ||
      bySlug.get(slug) ||
      byBasename.get(base) ||
      byTitle.get(lower) ||
      byAlias.get(lower) ||
      null
    )
  }
}

export function buildGraph(manifest) {
  const notes = manifest?.notes || []
  const resolve = buildResolver(notes)

  const nodes = notes.map((n) => ({
    id: n.slug,
    title: n.title,
    rel: n.rel,
    tags: n.tags || [],
    aliases: n.aliases || [],
    status: normalizeStatus(n.slug),
    neighbors: new Set(),
  }))

  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const edges = []

  for (const e of manifest?.edges || []) {
    const source = nodeById.has(e.source) ? e.source : resolve(e.source)
    const target = resolve(e.target)
    if (!source || !target || source === target) continue
    if (!nodeById.get(source).neighbors.has(target)) {
      nodeById.get(source).neighbors.add(target)
      nodeById.get(target).neighbors.add(source)
      edges.push({ source, target })
    }
  }

  const counts = { 'not-started': 0, learning: 0, mastered: 0 }
  for (const n of nodes) counts[n.status] += 1

  const tags = (manifest?.tags || []).map((t) => ({ name: t.name, count: t.count }))

  return { nodes, edges, counts, tags, nodeById }
}
