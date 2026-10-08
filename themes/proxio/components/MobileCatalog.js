import { useEffect, useState } from 'react'
import Catalog from './Catalog'

/**
 * 移动端悬浮目录入口
 *
 * 小屏（< xl）下以浮动按钮 + 抽屉的形式提供目录，
 * 不占用正文宽度；桌面端由 LayoutSlug 的侧边栏负责，此处隐藏。
 *
 * @param {*} props post
 */
export default function MobileCatalog({ post }) {
  const [showButton, setShowButton] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // 与主题既有浮动元素一致：滚动一段距离后才出现
  useEffect(() => {
    const onScroll = () => setShowButton(window.scrollY > 180)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const hasToc = Boolean(post?.toc && post.toc.length > 0)
  if (!hasToc || !showButton) {
    return null
  }

  return (
    <div id='proxio-mobile-catalog'>
      {/* 浮动入口按钮：位于回顶按钮上方，避免遮挡；抽屉展开时隐藏以免与面板重叠 */}
      {!drawerOpen && (
        <button
          type='button'
          aria-label='Catalog'
          onClick={() => setDrawerOpen(true)}
          className='fixed bottom-32 right-8 z-[999] flex h-10 w-10 items-center justify-center rounded-md bg-primary text-white shadow-md transition duration-300 ease-in-out hover:bg-dark xl:hidden'>
          <i className='fas fa-list-ol' />
        </button>
      )}

      {/* 目录抽屉：右侧滑入，覆盖式不挤压正文
          关闭态需平移「自身宽度 + right-4 的 1rem 偏移」，否则屏幕右缘会残留一条白边 */}
      <div
        className={
          (drawerOpen
            ? 'translate-x-0'
            : 'translate-x-[calc(100%+1rem)]') +
          ' fixed bottom-12 right-4 z-[999] w-60 rounded-xl bg-white py-2 shadow-md transition-transform duration-200 dark:bg-gray-900 xl:hidden'
        }>
        {post && (
          <div className='text-gray-600 dark:text-gray-400'>
            <Catalog post={post} />
          </div>
        )}
      </div>

      {/* 背景蒙版 */}
      <div
        className={
          (drawerOpen ? 'block' : 'hidden') +
          ' fixed top-0 left-0 z-[998] h-full w-full'
        }
        onClick={() => setDrawerOpen(false)}
      />
    </div>
  )
}
