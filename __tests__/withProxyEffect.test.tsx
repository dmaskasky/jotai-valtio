import React from 'react'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import type { SetStateAction } from 'jotai/vanilla'
import assert from 'minimalistic-assert'
import { withProxyEffect } from '../src/withProxyEffect'
import { ProxyState, SetAtom, WriteFn } from '../src/withProxyEffect/types'

it('should be defined on initial render', async () => {
  expect.assertions(1)
  const countAtom = atom(0)
  const atomWithProxyEffect = withProxyEffect(countAtom)

  let countProxyIsUndefined = false
  let runCount = 0
  function Test() {
    const countProxy = useAtomValue(atomWithProxyEffect)
    if (!countProxy) {
      countProxyIsUndefined = true
    }
    runCount++
    return null
  }

  render(<Test />)
  await waitFor(() => assert(runCount > 0))
  expect(countProxyIsUndefined).toBeFalsy()
})

it('should rerender only when the proxy value changes', async () => {
  expect.assertions(3)
  const countAtom = atom(0)
  const atomWithProxyEffect = withProxyEffect(countAtom)

  let runCount = 0
  function useTest() {
    runCount++
    const proxyValue = useAtomValue(atomWithProxyEffect)
    const setCount = useSetAtom(countAtom)
    return { proxyValue, setCount }
  }

  const { result } = renderHook(useTest)

  // vanilla Jotai renders twice on initial render
  expect(runCount).toBe(2)

  await act(async () => result.current.proxyValue.value++)

  expect(runCount).toBe(3)

  await act(async () => result.current.setCount(increment))

  expect(runCount).toBe(4)
})

it('should subscribe on mount, unsubscribe on unmount, and resubscribe on remount', async () => {
  expect.assertions(23)
  const countAtom = atom(0)
  const atomWithProxyEffect = withProxyEffect(countAtom)
  let targetAtom = atomWithProxyEffect
  let hasRun = false

  type TestResult = {
    proxyCount: ProxyState<number>
    count: number
    setCount: SetAtom<[SetStateAction<number>], void>
  }
  function useTest(): TestResult {
    hasRun = true
    const proxyCount = useAtomValue(targetAtom)
    const [count, setCount] = useAtom(countAtom)
    return { proxyCount, count, setCount }
  }

  let result: { current: TestResult }
  let unmount: () => void
  function remount() {
    hasRun = false
    ;({ result, unmount } = renderHook(useTest))
  }
  ;({ result, unmount } = renderHook(useTest))
  await waitFor(() => assert(hasRun))
  expect(result.current.proxyCount.value).toBe(0)
  expect(result.current.count).toBe(0)

  await act(async () => result.current.proxyCount.value++)
  expect(result.current.proxyCount.value).toBe(1)
  expect(result.current.count).toBe(1)

  await act(async () => result.current.setCount(increment))
  expect(result.current.proxyCount.value).toBe(2)
  expect(result.current.count).toBe(2)

  unmount()

  expect(result.current.count).toBe(2)

  await act(async () => result.current.setCount(increment))
  expect(result.current.count).toBe(2)
  expect(result.current.proxyCount.value).toBe(3)

  await act(async () => result.current.proxyCount.value++)
  expect(result.current.proxyCount.value).toBe(4)
  expect(result.current.count).toBe(2) // unmounted count does not update

  remount()

  await waitFor(() => assert(hasRun))
  expect(result.current.count).toBe(4)
  expect(result.current.proxyCount.value).toBe(4)

  await act(async () => result.current.setCount(increment))
  expect(result.current.proxyCount.value).toBe(5)
  expect(result.current.count).toBe(5)

  await act(async () => result.current.proxyCount.value++)
  expect(result.current.proxyCount.value).toBe(6)
  expect(result.current.count).toBe(6)

  unmount()

  // changing the target atom changes how the atom is mounted
  targetAtom = atom((get) => get(atomWithProxyEffect))
  remount()

  await waitFor(() => assert(hasRun))
  expect(result.current.proxyCount.value).toBe(6)
  expect(result.current.count).toBe(6)

  await act(async () => result.current.proxyCount.value++)
  expect(result.current.proxyCount.value).toBe(7)
  expect(result.current.count).toBe(7)

  await act(async () => result.current.setCount(increment))
  expect(result.current.proxyCount.value).toBe(8)
  expect(result.current.count).toBe(8)
})

it('should update the atom value when proxy value is changed', async () => {
  expect.assertions(4)
  const countAtom = atom(0)
  const atomWithProxyEffect = withProxyEffect(countAtom)

  function useTest() {
    const proxy = useAtomValue(atomWithProxyEffect)
    const count = useAtomValue(countAtom)
    return { proxy, count }
  }
  const { result } = renderHook(useTest)

  await act(async () => {
    result.current.proxy.value++
    // The proxy value is updated synchronously, and the atom value is updated asynchronously.
    expect(result.current.proxy.value).toBe(1)
    expect(result.current.count).toBe(0)
  })
  // The proxy value is updated synchronously, and the atom value is updated asynchronously.
  expect(result.current.proxy.value).toBe(1)
  expect(result.current.count).toBe(1)
})

it('should synchronize the initial value of the proxy with the atom value', async () => {
  expect.assertions(1)
  const countAtom = atom(5)
  const atomWithProxyEffect = withProxyEffect(countAtom)

  function useTest() {
    return useAtomValue(atomWithProxyEffect)
  }

  const { result } = renderHook(useTest)

  // the proxy value is initialized to the atom value
  expect(result.current.value).toBe(5)
})

it('should cause components to re-render when the proxy value changes', async () => {
  expect.assertions(5)
  const countAtom = atom(0)
  const atomWithProxyEffect = withProxyEffect(countAtom)

  let runCount = 0
  function useTest() {
    runCount++
    return useAtomValue(atomWithProxyEffect)
  }

  const { result, rerender } = renderHook(useTest)

  // the runCount should be 2 because vanilla Jotai causes one extra rerender on mount
  expect(runCount).toBe(2)

  await act(async () => result.current.value++)

  expect(runCount).toBe(3)
  expect(result.current.value).toBe(1)

  rerender()
  expect(runCount).toBe(4)
  expect(result.current.value).toBe(1)
})

it('should proxy nested objects and arrays in the atom state correctly', async () => {
  expect.assertions(13)
  const nestedAtom = atom({ array: [1, 2], object: { key: 'value' } })
  const atomWithProxyEffect = withProxyEffect(nestedAtom)

  let runCount = 0
  function useTest() {
    runCount++
    const proxy = useAtomValue(atomWithProxyEffect)
    const nested = useAtomValue(nestedAtom)
    return { proxy, nested }
  }

  const { result } = renderHook(useTest)

  expect(runCount).toBe(2)

  await act(async () => {
    // The proxy value is updated synchronously, and the atom value is updated asynchronously.
    result.current.proxy.value.array.push(3)
    expect(result.current.proxy.value.array).toEqual([1, 2, 3])
    expect(result.current.nested.array).not.toEqual([1, 2, 3])
  })
  expect(runCount).toBe(3)

  // The proxy value is updated synchronously, and the atom value is updated asynchronously.
  expect(result.current.proxy.value.array).toEqual([1, 2, 3])
  expect(result.current.nested.array).toEqual([1, 2, 3])

  await act(async () => {
    result.current.proxy.value.object.key = 'newValue'
    // The proxy value is updated synchronously, and the atom value is updated asynchronously.
    expect(result.current.proxy.value.object.key).toBe('newValue')
    expect(result.current.nested.object.key).not.toBe('newValue')
  })
  expect(runCount).toBe(4)
  // The proxy value is updated synchronously, and the atom value is updated asynchronously.
  expect(result.current.proxy.value.array).toEqual([1, 2, 3])
  expect(result.current.proxy.value.object.key).toBe('newValue')
  expect(result.current.nested.array).toEqual([1, 2, 3])
  expect(result.current.nested.object.key).toBe('newValue')
})

it('should update all subscribers when the proxy value changes', async () => {
  expect.assertions(6)
  const countAtom = atom(0)
  const atomWithProxyEffect = withProxyEffect(countAtom)

  let runCount1 = 0
  let runCount2 = 0

  function useTest1() {
    runCount1++
    const proxy = useAtomValue(atomWithProxyEffect)
    const setCount = useSetAtom(countAtom)
    return { proxy, setCount }
  }

  function useTest2() {
    runCount2++
    const proxy = useAtomValue(atomWithProxyEffect)
    const setCount = useSetAtom(countAtom)
    return { proxy, setCount }
  }

  const { result: result1 } = renderHook(useTest1)
  const { result: result2 } = renderHook(useTest2)

  // both components should render for the initial value
  expect(runCount1).toBe(2)
  expect(runCount2).toBe(2)

  await act(async () => result1.current.proxy.value++)

  // both components should rerender when the proxy value changes
  expect(runCount1).toBe(3)
  expect(runCount2).toBe(3)

  await act(async () => result2.current.setCount(increment))

  // both components should rerender when the atom value changes
  expect(runCount1).toBe(4)
  expect(runCount2).toBe(4)
})

it('should reflect the change in proxy when atom value is changed directly', async () => {
  expect.assertions(3)

  // Initial Setup
  const countAtom = atom(0)
  const atomWithProxyEffect = withProxyEffect(countAtom)

  // Hook to track run count and use atomValue
  let runCount = 0
  function useTest() {
    runCount++
    const proxy = useAtomValue(atomWithProxyEffect)
    const setCount = useSetAtom(countAtom)
    return { proxy, setCount }
  }

  // Rendering the hook
  const { result } = renderHook(useTest)

  // Initial Assertions
  expect(runCount).toBe(2) // Assuming the component renders once initially.
  expect(result.current.proxy.value).toBe(0)

  // Changing the atom's value directly and expecting the component to rerender and the proxy to update
  await act(async () => result.current.setCount(5))

  // Final Assertions after updating the atom value
  expect(result.current.proxy.value).toBe(5)
})

it('should correctly handle multiple synchronous updates to either the proxy or the atom', async () => {
  expect.assertions(6)

  // Initial Setup
  const countAtom = atom(0)
  const atomWithProxyEffect = withProxyEffect(countAtom)

  // Hook to track run count and use atomValue
  let runCount = 0
  function useTest() {
    runCount++
    const proxy = useAtomValue(atomWithProxyEffect)
    const setCount = useSetAtom(countAtom)
    return { proxy, setCount }
  }

  // Rendering the hook
  const { result } = renderHook(useTest)

  // the component renders once initially.
  expect(runCount).toBe(2)
  expect(result.current.proxy.value).toBe(0)

  // Applying multiple synchronous updates to the proxy
  await act(async () => {
    result.current.proxy.value++
    result.current.proxy.value++
    result.current.proxy.value++
  })

  // Assertions after updating the proxy
  expect(result.current.proxy.value).toBe(3)
  expect(runCount).toBe(3)

  // Applying multiple synchronous updates to the atom
  await act(async () => {
    result.current.setCount((prevCount) => prevCount + 1)
    result.current.setCount((prevCount) => prevCount + 1)
    result.current.setCount((prevCount) => prevCount + 1)
  })

  // Final Assertions after updating the atom value
  expect(result.current.proxy.value).toBe(6)
  expect(runCount).toBe(4)
})

it('should correctly handle updates via writable atom', async () => {
  expect.assertions(8)
  const countAtom = atom(0)
  const atomWithProxyEffect = withProxyEffect(countAtom)
  const writableAtom = atom(null, (get, set, value: number) => {
    const proxyState = get(atomWithProxyEffect)
    expect(get(countAtom)).toBe(-1)
    expect(proxyState.value).toBe(-1)

    expect(get(countAtom)).not.toBe(value)

    proxyState.value = value
    expect(proxyState.value).toBe(value)
    expect(get(countAtom)).toBe(value)

    set(countAtom, increment)
    expect(proxyState.value).toBe(value + 1)

    proxyState.value++
    expect(proxyState.value).toBe(value + 2)
    expect(get(countAtom)).toBe(value + 2)
  })
  let isMounted = false
  writableAtom.onMount = () => {
    isMounted = true
  }
  function useTest() {
    const proxyState = useAtomValue(atomWithProxyEffect)
    const [, setCount] = useAtom(writableAtom)
    return { proxyState, setCount }
  }
  const { result } = renderHook(useTest)
  await waitFor(() => assert(isMounted))
  await act(async () => {
    result.current.proxyState.value--
    result.current.setCount(1)
  })
})

it('should correctly handle updates from the read function', async () => {
  expect.assertions(11)
  const countAtom = atom(0)
  const atomWithProxyEffect = withProxyEffect(countAtom)
  const isMountedAtom = atom(false)
  const enableAfterMountedAtom = atom<boolean, [boolean | void], void>(
    false,
    (_, set) => {
      set(enableAfterMountedAtom, true)
    }
  )
  const readOnlyAtom = atom(
    (get) => {
      const proxyState = get(atomWithProxyEffect)
      if (!get(isMountedAtom)) {
        expect(get(countAtom)).toBe(0)
        expect(proxyState.value).toBe(0)

        proxyState.value++
        expect(proxyState.value).toBe(1)
        // initial render should not update the atom value synchronously
        expect(get(countAtom)).toBe(0)
        return get(countAtom)
      }
      if (!get(enableAfterMountedAtom)) {
        return get(countAtom)
      }
      expect(proxyState.value).toBe(1)
      expect(get(countAtom)).toBe(1)

      proxyState.value++
      expect(proxyState.value).toBe(2)
      expect(get(countAtom)).toBe(2)
      return get(countAtom)
    },
    (get, set, writeFn: WriteFn) => writeFn(get, set)
  )
  readOnlyAtom.onMount = (writeFn) => {
    writeFn((_, set) => set(isMountedAtom, true))
  }
  function useTest() {
    const count = useAtomValue(readOnlyAtom)
    const isMounted = useAtomValue(isMountedAtom)
    const enableAfterMounted = useSetAtom(enableAfterMountedAtom)
    return { isMounted, count, enableAfterMounted }
  }
  const { result } = renderHook(useTest)
  expect(result.current.count).toBe(0)
  await waitFor(() => assert(result.current.isMounted))
  await waitFor(() => assert(result.current.count === 1))
  expect(result.current.count).toBe(1)
  await act(result.current.enableAfterMounted)
})

it('should set falsy value', async () => {
  expect.assertions(1)
  const countAtom = atom(1)
  const atomWithProxyEffect = withProxyEffect(countAtom)
  function useTest() {
    const proxyState = useAtomValue(atomWithProxyEffect)
    return { proxyState }
  }
  const { result } = renderHook(useTest)
  await act(async () => {
    result.current.proxyState.value = 0
  })
  expect(result.current.proxyState.value).toBe(0)
})

it('should reject writing to properties other than `value`', async () => {
  expect.assertions(2)
  const countAtom = atom(0)
  const atomWithProxyEffect = withProxyEffect(countAtom)
  function useTest() {
    const proxyState = useAtomValue(atomWithProxyEffect)
    return { proxyState }
  }
  const { result } = renderHook(useTest)
  expect(async () => {
    await act(() => {
      result.current.proxyState.value = 1
    })
  }).not.toThrow()
  expect(() => {
    // @ts-expect-error attempting to write to a property other than `value`
    result.current.proxyState.NOT_VALUE = 'TEST'
  }).toThrow() // 'set' on proxy: trap returned falsish for property 'NOT_VALUE'
})

it('should not allow writing to the proxy value when the atom is read-only', async () => {
  expect.assertions(1)
  const countAtom = atom(() => 0)
  // @ts-expect-error attempting to pass a read-only atom to withProxyEffect
  const atomWithProxyEffect = withProxyEffect(countAtom)
  function useTest() {
    const proxyState = useAtomValue(atomWithProxyEffect)
    return { proxyState }
  }
  const { result } = renderHook(useTest)
  expect(() => {
    result.current.proxyState.value = 1
  }).toThrow() // 'atom.write is not a function'
})

it('should process updates asynchronously when sync option is false', async () => {
  expect.assertions(3)
  const countAtom = atom(0)
  let isMounted = false
  countAtom.onMount = () => {
    isMounted = true
  }
  const atomWithProxyEffect = withProxyEffect(countAtom, { sync: false })
  function useTest() {
    const proxyState = useAtomValue(atomWithProxyEffect)
    return { proxyState }
  }
  const { result } = renderHook(useTest)
  await waitFor(() => assert(isMounted))
  await act(async () => {
    result.current.proxyState.value++
    expect(result.current.proxyState.value).toBe(1)
    expect(result.current.proxyState.value).not.toBe(0)
  })
  expect(result.current.proxyState.value).toBe(1)
})

function increment(count: number) {
  return count + 1
}
