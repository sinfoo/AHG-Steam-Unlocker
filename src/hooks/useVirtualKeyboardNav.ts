import { useCallback, useEffect, useRef, useState } from 'react'
import type { Virtualizer } from '@tanstack/react-virtual'

export interface VirtualKeyboardNavOptions<T> {
  virtualizer: Virtualizer<HTMLDivElement, Element>
  items: ReadonlyArray<T>
  onActivate: (item: T) => void
  columns?: number
}

export interface VirtualKeyboardNavReturn<T> {
  focusedIndex: number
  focusedItem: T | null
  setFocusedIndex: (index: number) => void
  keyboardProps: {
    tabIndex: number
    onKeyDown: (e: React.KeyboardEvent) => void
  }
}

/**
 * Arrow-key keyboard navigation hook for TanStack Virtual virtualized lists.
 *
 * - ArrowDown/ArrowRight: increment focusedIndex (wraps around)
 * - ArrowUp/ArrowLeft: decrement focusedIndex (wraps around)
 * - Enter/Space: calls onActivate with the focused item
 * - Home: jump to index 0
 * - End: jump to last index
 * - When focusedIndex is outside the visible window, scroll it into view
 * - focusedIndex resets to -1 when items.length changes
 */
export function useVirtualKeyboardNav<T>(
  virtualizer: Virtualizer<HTMLDivElement, Element>,
  items: ReadonlyArray<T>,
  onActivate: (item: T) => void,
  columns = 1,
): VirtualKeyboardNavReturn<T> {
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const onActivateRef = useRef(onActivate)
  onActivateRef.current = onActivate

  const itemsRef = useRef(items)
  itemsRef.current = items

  // Reset focus when the list content changes
  useEffect(() => {
    setFocusedIndex(-1)
  }, [items.length])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const len = itemsRef.current.length
    if (len === 0) return

    let newIndex = focusedIndex

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault()
        newIndex = focusedIndex < 0 ? 0 : (focusedIndex + 1) % len
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault()
        if (focusedIndex < 0) {
          newIndex = len - 1
        } else {
          newIndex = (focusedIndex - 1 + len) % len
        }
        break
      case 'Home':
        e.preventDefault()
        newIndex = 0
        break
      case 'End':
        e.preventDefault()
        newIndex = len - 1
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < len) {
          onActivateRef.current(itemsRef.current[focusedIndex]!)
        }
        return
      default:
        return
    }

    setFocusedIndex(newIndex)
  }, [focusedIndex])

  // Scroll focused index into view if it's outside the visible window
  useEffect(() => {
    if (focusedIndex < 0) return
    const virtualItems = virtualizer.getVirtualItems()
    if (virtualItems.length === 0) return

    const focusedRow = Math.floor(focusedIndex / columns)
    const firstRow = virtualItems[0]!.index
    const lastRow = virtualItems[virtualItems.length - 1]!.index

    if (focusedRow < firstRow || focusedRow > lastRow) {
      virtualizer.scrollToIndex(focusedRow, { align: 'auto', behavior: 'smooth' })
    }
  }, [focusedIndex, virtualizer, columns])

  const focusedItem: T | null =
    focusedIndex >= 0 && focusedIndex < items.length
      ? items[focusedIndex]!
      : null

  return {
    focusedIndex,
    focusedItem,
    setFocusedIndex,
    keyboardProps: {
      tabIndex: 0,
      onKeyDown: handleKeyDown,
    },
  }
}
