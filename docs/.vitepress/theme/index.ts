// .vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme'
import type { EnhanceAppContext } from 'vitepress'
import type { Theme } from 'vitepress'
import { onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vitepress'
import type { default as mermaid } from 'mermaid'
import './style.css'

let mermaidInstance: typeof mermaid | null = null

// 初始化 Mermaid
const initMermaid = async () => {
  if (typeof window === 'undefined') return

  if (!mermaidInstance) {
    const { default: m } = await import('mermaid')
    mermaidInstance = m
    mermaidInstance.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      flowchart: {
        curve: 'basis',
        padding: 20,
      },
      sequence: {
        diagramMarginX: 50,
        diagramMarginY: 10,
        boxMargin: 10,
        showSequenceNumbers: true,
      },
      gantt: {
        titleTopMargin: 25,
        barHeight: 20,
        barGap: 4,
      },
    })
  }

  return mermaidInstance
}

// 为 SVG 添加简单的缩放和拖拽功能
const initZoomPan = (svg: SVGElement, wrapper: HTMLElement) => {
  let scale = 1
  let panning = false
  let panStart = { x: 0, y: 0 }
  let translate = { x: 0, y: 0 }

  // 设置 SVG 样式
  svg.style.transformOrigin = '0 0'
  svg.style.transform = 'translate(0px, 0px) scale(1)'
  svg.style.cursor = 'grab'

  // 鼠标滚轮缩放
  wrapper.addEventListener('wheel', (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.1, Math.min(5, scale * delta))

    scale = newScale
    svg.style.transform = `translate(${translate.x}px, ${translate.y}px) scale(${scale})`
  }, { passive: false })

  // 鼠标拖拽
  svg.addEventListener('mousedown', (e) => {
    panning = true
    panStart = { x: e.clientX - translate.x, y: e.clientY - translate.y }
    svg.style.cursor = 'grabbing'
  })

  window.addEventListener('mousemove', (e) => {
    if (!panning) return
    e.preventDefault()
    translate = {
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    }
    svg.style.transform = `translate(${translate.x}px, ${translate.y}px) scale(${scale})`
  })

  window.addEventListener('mouseup', () => {
    panning = false
    svg.style.cursor = 'grab'
  })

  // 双击重置
  svg.addEventListener('dblclick', () => {
    scale = 1
    translate = { x: 0, y: 0 }
    svg.style.transform = 'translate(0px, 0px) scale(1)'
  })
}

// 渲染页面上的 mermaid 图表
const renderMermaid = async () => {
  const mermaid = await initMermaid()
  if (!mermaid) return

  // 查找所有 mermaid 代码块
  const elements = document.querySelectorAll<HTMLPreElement>('.language-mermaid pre')

  for (const pre of elements) {
    // 跳过已渲染的元素
    if (pre.parentElement?.classList.contains('mermaid-rendered')) continue

    const codeElement = pre.querySelector('code')
    if (!codeElement) continue

    const graphDefinition = codeElement.textContent || ''
    if (!graphDefinition.trim()) continue

    try {
      // 创建容器元素
      const container = document.createElement('div')
      container.className = 'mermaid'
      container.textContent = graphDefinition

      // 隐藏原始代码块
      pre.style.display = 'none'
      pre.parentElement?.classList.add('mermaid-rendered')

      // 插入容器
      pre.parentElement?.insertBefore(container, pre.nextSibling)
    } catch (e) {
      console.warn('Mermaid render error:', e)
    }
  }

  // 重新运行 mermaid 渲染
  try {
    await mermaid.run({
      querySelector: '.mermaid:not([data-processed])',
      suppressErrors: true,
    })

    // 为渲染后的 SVG 添加缩放拖拽功能
    await new Promise(resolve => setTimeout(resolve, 100))

    const svgs = document.querySelectorAll('.mermaid svg')
    for (let i = 0; i < svgs.length; i++) {
      const svg = svgs[i] as SVGElement
      const viewBox = svg.getAttribute('viewBox')
      if (!viewBox) continue

      const [, , , height] = viewBox.split(' ').map(Number)

      // 创建包装容器
      const parent = svg.parentElement
      if (!parent) continue

      const wrapper = document.createElement('div')
      wrapper.className = 'mermaid-zoom-pan-wrapper'
      wrapper.style.cssText = `
        width: 100%;
        height: ${Math.min(height, 800)}px;
        overflow: auto;
        border: 1px solid #e5e5e5;
        border-radius: 8px;
        background: #fff;
      `

      // 设置 SVG 样式
      svg.style.transformOrigin = 'top left'
      svg.style.minWidth = '100%'

      parent.insertBefore(wrapper, svg)
      wrapper.appendChild(svg)

      // 初始化缩放拖拽
      initZoomPan(svg, wrapper)
    }
  } catch (e) {
    console.warn('Mermaid run error:', e)
  }
}

export default {
  extends: DefaultTheme,
  setup() {
    const route = useRoute()

    // 监听路由变化，在页面切换后重新渲染 mermaid
    watch(
      () => route.path,
      () => {
        nextTick(() => {
          renderMermaid()
        })
      }
    )

    // 首次加载时渲染
    onMounted(() => {
      // 等待 DOM 完全渲染
      setTimeout(() => {
        renderMermaid()
      }, 100)

      // 初始化专注模式
      initFocusMode()
    })
  },
  enhanceApp({ app }: EnhanceAppContext) {
    // 可以在这里添加其他 Vue 应用级别的配置
  },
} satisfies Theme

// ============================================
// 专注模式功能
// ============================================

const FOCUS_MODE_STORAGE_KEY = 'nginx-handbook-focus-mode'

const initFocusMode = () => {
  if (typeof document === 'undefined') return

  // 检查是否已经在页面中存在切换按钮
  if (document.querySelector('.focus-mode-toggle')) return

  // 创建专注模式切换按钮
  const toggleButton = document.createElement('button')
  toggleButton.className = 'focus-mode-toggle'
  toggleButton.setAttribute('aria-label', '专注模式')
  toggleButton.setAttribute('title', '专注模式 (快捷键：F)')
  toggleButton.innerHTML = `
    <svg id="focus-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 9V4H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M20 9V4H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M4 15V20H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M20 15V20H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `

  // 创建退出提示
  const exitHint = document.createElement('div')
  exitHint.className = 'focus-mode-exit-hint'
  exitHint.textContent = '按 F 或点击按钮退出'

  document.body.appendChild(toggleButton)
  document.body.appendChild(exitHint)

  // 从本地存储恢复专注模式状态
  const wasInFocusMode = localStorage.getItem(FOCUS_MODE_STORAGE_KEY) === 'true'
  if (wasInFocusMode) {
    document.body.classList.add('focus-mode')
    updateFocusIcon(true)
  }

  // 切换按钮点击事件
  toggleButton.addEventListener('click', () => {
    toggleFocusMode()
  })

  // 键盘快捷键支持 (按 F 切换)
  document.addEventListener('keydown', (e) => {
    // 检查是否在输入框中
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault()
      toggleFocusMode()
    }
  })

  function toggleFocusMode() {
    document.body.classList.toggle('focus-mode')
    const isInFocusMode = document.body.classList.contains('focus-mode')
    localStorage.setItem(FOCUS_MODE_STORAGE_KEY, isInFocusMode ? 'true' : 'false')
    updateFocusIcon(isInFocusMode)
  }

  function updateFocusIcon(isInFocusMode: boolean) {
    const icon = document.getElementById('focus-icon')
    if (!icon) return

    if (isInFocusMode) {
      // 专注模式激活时的图标（收缩状态）
      icon.innerHTML = `
        <path d="M4 14H9V9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M20 14H15V9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4 10H9V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M20 10H15V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      `
    } else {
      // 专注模式关闭时的图标（展开状态）
      icon.innerHTML = `
        <path d="M4 9V4H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M20 9V4H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4 15V20H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M20 15V20H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      `
    }
  }
}
