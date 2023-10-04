import { atom } from 'jotai'
import type { Getter, Setter } from 'jotai'
import { proxy, snapshot, subscribe } from 'valtio'
import {
  Options,
  PromiseOrValue,
  ProxyState,
  SetCb,
  SetSelf,
  Store,
  Wrapped,
  WriteFn,
} from './types'

export function mutableAtom<Value>(
  value: Value,
  options: Options<Value> = defaultOptions
) {
  const { proxyFn } = { ...defaultOptions, ...options }

  const valueAtom = atom({ value })

  if (process.env.NODE_ENV !== 'production') {
    valueAtom.debugPrivate = true
  }

  const storeAtom = atom(
    () =>
      ({
        isMounted: false,
        proxyState: null,
        unsubscribe: null,
      } as Store<Value>),
    (get, set, isOnMount: boolean) => {
      if (isOnMount) {
        createProxyState(get, (fn) => fn(set))
      } else {
        onAtomUnmount(get)
      }
    }
  )

  storeAtom.onMount = (setOnMount) => {
    // switch to synchronous imperative updates on mount
    setOnMount(true)
    return () => setOnMount(false)
  }

  if (process.env.NODE_ENV !== 'production') {
    storeAtom.debugPrivate = true
  }

  /**
   * unsubscribe on atom unmount
   */
  function onAtomUnmount(get: Getter) {
    get(storeAtom).unsubscribe?.()
    get(storeAtom).isMounted = false
  }

  /**
   * sync the proxy state with the atom
   */
  function onChange(get: Getter, setCb: SetCb) {
    return () => {
      const { proxyState } = get(storeAtom)
      if (proxyState === null) return
      const { value } = snapshot(proxyState)
      if (value !== get(valueAtom).value) {
        setCb((set) => set(valueAtom, { value } as Wrapped<Awaited<Value>>))
      }
    }
  }

  /**
   * create the proxy state and subscribe to it
   */
  function createProxyState(get: Getter, setCb: SetCb) {
    const store = get(storeAtom)
    const { value } = get(valueAtom)
    store.proxyState ??= proxyFn({ value })
    store.proxyState.value = value
    const unsubscribe = subscribe(store.proxyState, onChange(get, setCb), true)
    store.unsubscribe?.()
    store.unsubscribe = () => {
      store.unsubscribe = null
      unsubscribe()
    }
    store.isMounted = true
    return store.proxyState
  }

  /**
   * return the proxy if it exists, otherwise create and subscribe to it
   */
  function ensureProxyState(get: Getter, setCb: SetCb) {
    const { isMounted, proxyState } = get(storeAtom)
    if (proxyState === null || !isMounted) {
      return createProxyState(get, setCb)
    }
    return proxyState
  }

  /**
   * wrap the proxy state in a proxy to ensure rerender on value change
   */
  function wrapProxyState(
    proxyState: ProxyState<Value>,
    get: Getter,
    setCb: SetCb
  ) {
    return new Proxy(proxyState, {
      get: (target, property) => {
        if (property === 'value') {
          ensureProxyState(get, setCb)
        }
        return target[property as keyof ProxyState<Value>]
      },
      set(target, property, value) {
        if (property === 'value') {
          ensureProxyState(get, setCb)
          target[property] = value
          return true
        }
        return false
      },
    })
  }

  /**
   * create an atom that returns the proxy state
   */
  const proxyEffectBaseAtom = atom<ProxyState<Value>, [WriteFn], void>(
    (get, { setSelf }) => {
      get(valueAtom) // subscribe to value updates
      const setCb = makeSetCb(setSelf)
      const proxyState = ensureProxyState(get, setCb)
      return wrapProxyState(proxyState, get, setCb)
    },
    (get, set, writeFn: WriteFn) => writeFn(get, set)
  )

  if (process.env.NODE_ENV !== 'production') {
    proxyEffectBaseAtom.debugPrivate = true
  }

  const proxyEffectAtom = atom((get) => get(proxyEffectBaseAtom))
  return proxyEffectAtom
}

const defaultOptions = {
  proxyFn: proxy,
}

/**
 * create a set callback that defers execution until next microtask
 */
const makeSetCb =
  (setSelf: SetSelf<[WriteFn]>): SetCb =>
  (fn: (set: Setter) => void) =>
    defer(() => setSelf((_, set) => fn(set)))

/**
 * delays execution until next microtask
 * */
function defer(fn?: () => PromiseOrValue<void>) {
  return Promise.resolve().then(fn)
}
