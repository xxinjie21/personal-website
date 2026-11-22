/* 三张开发页共用的交互层：顶栏投影 + 入场错峰 + 复制提示词
   由 custom-pages/_embed/frame.js 提供，构建后位于 /embed/frame.js */
(() => {
  // 统一复制：按钮变「已复制」1.4 秒，失败时退回 execCommand
  window.frameCopy = async function (text, btn, doneLabel = '已复制') {
    if (!text) return
    const body = text.trim()
    try {
      await navigator.clipboard.writeText(body)
    } catch (err) {
      const ta = document.createElement('textarea')
      ta.value = body
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    if (!btn) return
    const old = btn.dataset.label || btn.textContent
    btn.textContent = doneLabel
    btn.classList.add('done')
    setTimeout(() => {
      btn.textContent = old
      btn.classList.remove('done')
    }, 1400)
  }

  // 切换分组/阶段时统一给内容一次「淡入上浮」，重启动画不叠帧
  window.frameSwap = function (el) {
    if (!el) return
    el.classList.remove('swap-in')
    void el.offsetWidth
    el.classList.add('swap-in')
  }

  // 悬浮滚动条：挂在滚动容器旁的 4px 细条，鼠标进来或滚动时才出现，不占宽度
  window.frameOverlay = function (scroller, host) {
    if (!scroller) return null
    const rail = document.createElement('div')
    rail.className = 'ovs'
    rail.innerHTML = '<div class="ovs-thumb"></div>'
    ;(host || scroller.parentElement).appendChild(rail)
    const thumb = rail.firstChild
    let timer = 0
    const update = () => {
      const vh = scroller.clientHeight
      const sh = scroller.scrollHeight
      if (sh - vh < 8) return false
      const h = Math.max(24, (vh * vh) / sh)
      thumb.style.height = h + 'px'
      thumb.style.top = ((scroller.scrollTop / (sh - vh)) * (vh - h)) + 'px'
      return true
    }
    const flash = () => {
      if (!update()) return
      rail.classList.add('on')
      clearTimeout(timer)
      timer = setTimeout(() => rail.classList.remove('on'), 800)
    }
    scroller.addEventListener('scroll', flash, { passive: true })
    scroller.addEventListener('pointerenter', () => { if (update()) rail.classList.add('on') })
    scroller.addEventListener('pointerleave', () => rail.classList.remove('on'))
    window.addEventListener('resize', update, { passive: true })
    return { refresh: update }
  }

  const bar = document.querySelector('.devbar')
  if (bar) {
    const onScroll = () => bar.classList.toggle('lifted', (window.scrollY || 0) > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
  }

  // 三页互跳时先淡出再换页，避免白闪直接砸到脸上
  const calm = matchMedia('(prefers-reduced-motion: reduce)')
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.devbar a, .swap-link')
    if (!link || link.target === '_blank' || e.metaKey || e.ctrlKey) return
    const href = link.getAttribute('href')
    if (!href || href.startsWith('#') || href === location.pathname.split('/').pop()) return
    if (calm.matches) return
    e.preventDefault()
    document.documentElement.classList.add('leaving')
    setTimeout(() => { location.href = link.href }, 210)
  })

  const items = Array.from(document.querySelectorAll('.reveal'))
  if (!items.length) return

  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((el) => el.classList.add('in'))
    return
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('in')
        io.unobserve(entry.target)
      })
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.08 }
  )

  items.forEach((el, i) => {
    el.style.setProperty('--d', Math.min(i, 6) * 70 + 'ms')
    io.observe(el)
  })
})()
