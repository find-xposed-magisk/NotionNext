/**
 * Catalog 滚动高亮回归测试
 *
 * 背景：PROXIO_POST_CATALOG_SHOW_LEVEL3 默认 false 时 filteredToc 只含
 * L1/L2 项，但滚动监听曾扫描全部 .notion-h——当读者滚到三级标题时
 * activeSection 被设为该隐藏标题的 id，目录中没有任何行匹配，高亮消失。
 * 修复：只在已显示目录项对应的标题中选择当前项（滚过隐藏 L3 时回退到
 * 最近的可见父章节，因其 bbox 仍在视口上方）。
 */
import { render, screen, act } from '@testing-library/react'
import React from 'react'
import Catalog from '@/themes/proxio/components/Catalog'
import { useGlobal } from '@/lib/global'
import { siteConfig } from '@/lib/config'
import { uuidToId } from 'notion-utils'

jest.mock('@/lib/global', () => ({
  useGlobal: jest.fn(() => ({ locale: { COMMON: { TABLE_OF_CONTENTS: '目录' } } }))
}))

jest.mock('@/lib/config', () => ({
  siteConfig: jest.fn()
}))

// notion-utils 是 ESM 包，jest 环境下直接提供 uuidToId 实现
jest.mock('notion-utils', () => ({
  uuidToId: id => String(id).replace(/-/g, '').slice(0, 8)
}))

jest.mock('lib/utils/throttle', () => {
  // 测试中直接同步执行，便于触发 scroll 断言
  return { __esModule: true, default: fn => {
    const wrapped = (...args) => fn(...args)
    wrapped.cancel = () => {}
    return wrapped
  } }
})

const uuid = n => `${n}-aaaa-bbbb-cccc-dddddddddddd`

// L1 → L2 → L3 三级标题，id 与 toc 一一对应
// （过滤规则是 indentLevel < maxDepth，L1=1 L2=2 L3=3）
const toc = [
  { id: uuid('h1'), text: '第一章', indentLevel: 0 },
  { id: uuid('h2'), text: '第一节', indentLevel: 1 },
  { id: uuid('h3'), text: '小节', indentLevel: 2 }
]

const post = { toc }

const mountHeadings = () => {
  // top < 0 表示已滚过视口顶部
  const headings = [
    { id: uuidToId(uuid('h1')), top: -800, bottom: -700 },
    { id: uuidToId(uuid('h2')), top: -600, bottom: -300 },
    // 三级标题：当前滚动位置停在这里（top 50 未过线）
    { id: uuidToId(uuid('h3')), top: 50, bottom: 200 }
  ]
  const els = headings.map(h => {
    const el = document.createElement('div')
    el.className = 'notion-h'
    el.setAttribute('data-id', h.id)
    el.getBoundingClientRect = () => ({
      top: h.top,
      bottom: h.bottom,
      left: 0,
      right: 0,
      width: 100,
      height: h.bottom - h.top
    })
    document.body.appendChild(el)
    return el
  })
  return els
}

describe('Catalog 滚动高亮（SHOW_LEVEL3 默认关闭）', () => {
  let headings
  let scrollSpy
  beforeAll(() => {
    // jsdom 没有 scrollTo / Element.scrollTo
    window.scrollTo = () => {}
    Element.prototype.scrollTo = () => {}
  })
  beforeEach(() => {
    siteConfig.mockReset()
    siteConfig.mockImplementation((key, defaultVal) => {
      if (key === 'PROXIO_POST_CATALOG_SHOW_LEVEL3') return false
      if (key === 'PROXIO_POST_CATALOG_SCROLL_BEHAVIOR') return 'instant'
      return defaultVal
    })
    document.body.innerHTML = ''
    headings = mountHeadings()
  })
  afterEach(() => {
    headings.forEach(el => el.remove())
  })

  it('滚过三级标题时，高亮回退到最近可见的二级目录项而不是消失', () => {
    const { container } = render(<Catalog post={post} />)

    // 目录应只显示 2 项（L3 被过滤）
    expect(screen.getByText('第一章')).toBeInTheDocument()
    expect(screen.getByText('第一节')).toBeInTheDocument()
    expect(screen.queryByText('小节')).not.toBeInTheDocument()

    // 触发滚动判定：此时 DOM 里的当前标题是三级标题「小节」
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })

    // 当前滚动位置落在 L3（top=50 未过线），L2 已滚过（top=-600 < 0）
    // → 应高亮 L2「第一节」（最近可见父章节）
    const active = container.querySelector(
      '.bg-primary\\/10, [class*="bg-primary"]'
    )
    expect(active).not.toBeNull()
    expect(active.textContent).toBe('第一节')
  })

  it('滚动位置在开头时高亮第一个目录项', () => {
    // 全部标题都在视口下方 → 回退高亮第一项
    headings.forEach(el => {
      const rect = el.getBoundingClientRect()
      el.getBoundingClientRect = () => ({ ...rect, top: 500, bottom: 600 })
    })
    const { container } = render(<Catalog post={post} />)
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })

    const active = container.querySelector('[class*="bg-primary"]')
    expect(active).not.toBeNull()
    expect(active.textContent).toBe('第一章')
  })
})
