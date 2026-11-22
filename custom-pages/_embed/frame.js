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

  const bar = document.querySelector('.devbar')
  if (bar) {
    const onScroll = () => bar.classList.toggle('lifted', (window.scrollY || 0) > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
  }

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
