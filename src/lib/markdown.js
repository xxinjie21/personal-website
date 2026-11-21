// Markdown 渲染：marked + KaTeX，支持 Obsidian 语法（[[双链]]、![[图片]]、$公式$）
import { Marked } from 'marked'
import katex from 'katex'

const ASSET_BASE = `${import.meta.env.BASE_URL || './'}notes-assets/`.replace(/([^:]\/)\/+/g, '$1')

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

export function slugifyHeading(text) {
  return text
    .toLowerCase()
    .replace(/[`*_~$]/g, '')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'section'
}

function renderMath(tex, display) {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html' })
  } catch {
    return `<span class="math-error">${esc(tex)}</span>`
  }
}

const extensions = {
  wikiImage: {
    name: 'wikiImage',
    level: 'inline',
    start(src) {
      const i = src.indexOf('![[')
      return i < 0 ? undefined : i
    },
    tokenizer(src) {
      const m = src.match(/^!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/)
      if (!m) return
      const name = m[1].trim().split(/[\\/]/).pop()
      return {
        type: 'wikiImage',
        raw: m[0],
        name,
        alt: (m[2] || name).trim(),
        href: `${ASSET_BASE}${encodeURIComponent(name).replace(/%2F/g, '/')}`,
      }
    },
    renderer(token) {
      return `<figure class="md-figure"><img class="md-img" src="${token.href}" alt="${esc(token.alt)}" loading="lazy" data-alt="${esc(token.alt)}"></figure>`
    },
  },
  wikiLink: {
    name: 'wikiLink',
    level: 'inline',
    start(src) {
      const i = src.indexOf('[[')
      return i < 0 ? undefined : i
    },
    tokenizer(src) {
      const m = src.match(/^\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/)
      if (!m) return
      const target = m[1].trim()
      return {
        type: 'wikiLink',
        raw: m[0],
        target,
        label: (m[2] || target.split(/[\\/]/).pop()).trim(),
      }
    },
    renderer(token) {
      return `<a class="wiki-link" data-target="${esc(token.target)}" href="javascript:void(0)">${esc(token.label)}</a>`
    },
  },
  mathBlock: {
    name: 'mathBlock',
    level: 'block',
    start(src) {
      const i = src.indexOf('$$')
      return i < 0 ? undefined : i
    },
    tokenizer(src) {
      const m = src.match(/^\$\$([\s\S]+?)\$\$/)
      if (!m) return
      return { type: 'mathBlock', raw: m[0], tex: m[1].trim() }
    },
    renderer(token) {
      return `<div class="md-math-block">${renderMath(token.tex, true)}</div>`
    },
  },
  mathInline: {
    name: 'mathInline',
    level: 'inline',
    start(src) {
      const i = src.indexOf('$')
      return i < 0 ? undefined : i
    },
    tokenizer(src) {
      const m = src.match(/^\$([^\n$]+?)\$/)
      if (!m) return
      return { type: 'mathInline', raw: m[0], tex: m[1].trim() }
    },
    renderer(token) {
      return renderMath(token.tex, false)
    },
  },
}

const marked = new Marked({ gfm: true, breaks: false })
marked.use({ extensions: Object.values(extensions) })

const headingCounters = new Map()
const baseRenderer = new marked.Renderer
const headingRenderer = new marked.Renderer()
headingRenderer.heading = function (token) {
  // marked v9+ 传入的是 token 对象，而不是 (text, level)
  const depth = token.depth || 1
  const inline = token.tokens && this.parser ? this.parser.parseInline(token.tokens) : String(token.text || token)
  const plain = inline.replace(/<[^>]+>/g, '')
  const base = slugifyHeading(plain)
  const n = (headingCounters.get(base) || 0) + 1
  headingCounters.set(base, n)
  const id = n === 1 ? base : `${base}-${n}`
  return `<h${depth} id="${id}" class="md-heading">${inline}</h${depth}>`
}
headingRenderer.link = function (href, title, text) {
  const isExternal = /^https?:/i.test(href || '')
  const attrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
  return `<a href="${href}"${title ? ` title="${title}"` : ''}${attrs}>${text}</a>`
}
headingRenderer.image = function (token) {
  // marked v9+ 传 token 对象；相对路径统一指向 notes-assets/
  const href = token.href || ''
  const alt = token.text || ''
  const src = /^(https?:|data:|\/)/i.test(href)
    ? href
    : `${ASSET_BASE}${encodeURIComponent(href.split(/[\\/]/).pop())}`
  return `<figure class="md-figure"><img class="md-img" src="${esc(src)}" alt="${esc(alt)}" loading="lazy"><figcaption>${esc(alt)}</figcaption></figure>`
}
marked.use({ renderer: headingRenderer })

export function renderMarkdown(src = '') {
  headingCounters.clear()
  // 去掉 Obsidian 注释 %%...%%
  const cleaned = src.replace(/%%[\s\S]*?%%/g, '')
  return marked.parse(cleaned)
}

// 给代码块与表格加上复制按钮 / 横向滚动包装
export function enhanceRendered(container) {
  if (!container) return
  container.querySelectorAll('pre').forEach((pre) => {
    if (pre.querySelector('.code-copy')) return
    const btn = document.createElement('button')
    btn.className = 'code-copy'
    btn.type = 'button'
    btn.textContent = '复制'
    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code')?.textContent || pre.textContent || ''
      try {
        await navigator.clipboard.writeText(code)
        btn.textContent = '已复制'
      } catch {
        btn.textContent = '复制失败'
      }
      setTimeout(() => (btn.textContent = '复制'), 1500)
    })
    pre.appendChild(btn)
  })
  container.querySelectorAll('table').forEach((table) => {
    if (table.parentElement?.classList.contains('table-wrap')) return
    const wrap = document.createElement('div')
    wrap.className = 'table-wrap'
    table.parentElement.insertBefore(wrap, table)
    wrap.appendChild(table)
  })

  // 图片进视口再淡入：长文里滚动到哪张，哪张才浮现
  const io =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((en) => {
              if (!en.isIntersecting) return
              en.target.classList.add('img-in')
              io.unobserve(en.target)
            })
          },
          { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
        )
      : null
  container.querySelectorAll('.md-img').forEach((img) => {
    if (img.dataset.revealBound) return
    img.dataset.revealBound = '1'
    if (!io || img.complete) {
      img.classList.add('img-in')
      return
    }
    img.classList.add('img-await')
    io.observe(img)
  })
}

export function extractTags(text = '') {
  const out = new Set()
  for (const m of text.matchAll(/(^|[\s>])#([A-Za-z0-9一-龥_/-]+)/g)) out.add(m[2])
  return [...out]
}
