import { atom } from 'jotai'
import type { Getter, PrimitiveAtom, Setter } from 'jotai'
import { proxy, snapshot, subscribe } from 'valtio'
import type {
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
  const valueAtom = atom({ value })

  if (process.env.NODE_ENV !== 'production') {
    valueAtom.debugPrivate = true
  }
  return makeMutableAtom(valueAtom, options)
}

export function makeMutableAtom<Value>(
  valueAtom: PrimitiveAtom<Wrapped<Value>>,
  options: Options<Value> = defaultOptions
) {
  const { proxyFn } = { ...defaultOptions, ...options }

  const storeAtom = atom(
    () =>
      ({
        hasMounted: false,
        proxyState: null,
        unsubscribe: null,
      } as Store<Value>),
    (get, set) => {
      // switch to synchronous imperative updates on mount
      createProxyState(get, (fn) => fn(set))
    }
  )

  storeAtom.onMount = (setInit) => setInit()

  if (process.env.NODE_ENV !== 'production') {
    storeAtom.debugPrivate = true
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
    store.unsubscribe?.()
    store.unsubscribe = subscribe(store.proxyState, onChange(get, setCb), true)
    store.hasMounted = true
    return store.proxyState
  }

  /**
   * return the proxy if it exists, otherwise create and subscribe to it
   */
  function ensureProxyState(get: Getter, setCb: SetCb) {
    const { hasMounted, proxyState } = get(storeAtom)
    if (proxyState === null || !hasMounted) {
      return createProxyState(get, setCb)
    }
    return proxyState
  }

  /**
   * wrap the proxy state in a proxy to ensure rerender on value change
   */
  function wrapProxyState(proxyState: ProxyState<Value>) {
    return new Proxy(proxyState, {
      get: (target, property) => {
        return target[property as keyof ProxyState<Value>]
      },
      set(target, property, value) {
        if (property === 'value') {
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
      return wrapProxyState(proxyState)
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
 */
function defer(fn?: () => PromiseOrValue<void>) {
  return Promise.resolve().then(fn)
}
