import { Getter, Setter, WritableAtom, atom } from 'jotai'
import assert from 'minimalistic-assert'
import { proxy, snapshot, subscribe } from 'valtio'
import {
  ExtractFromSetStateAction,
  Options,
  PromiseOrValue,
  ProxyRef,
  ProxyState,
  SetCb,
  SetSelf,
  Store,
  WriteFn,
} from './types'

export function withProxyEffect<T, Result>(
  atomToSync: WritableAtom<T, [T], Result>,
  options: Options<T> = defaultOptions
) {
  type Value = ExtractFromSetStateAction<T>
  const { sync, proxyFn } = { ...defaultOptions, ...options }

  const storeAtom = atom(
    () => ({ unsubscribe: null, isMounted: false } as Store),
    (get, set, writeFn: WriteFn) => writeFn(get, set)
  )

  if (process.env.NODE_ENV !== 'production') {
    storeAtom.debugPrivate = true
  }

  storeAtom.onMount = (writeFn) => {
    // if sync is true, switch to synchronous imperative updates on mount
    if (sync) writeFn((get, set) => createProxyState(get, (fn) => fn(set)))
    return () => writeFn(onAtomUnmount)
  }
  /**
   * unsubscribe on atom unmount
   */
  function onAtomUnmount(get: Getter) {
    get(storeAtom).unsubscribe?.()
    get(storeAtom).isMounted = false
  }

  const proxyRefAtom = atom(() => ({ current: null } as ProxyRef<Value>))
  if (process.env.NODE_ENV !== 'production') {
    proxyRefAtom.debugPrivate = true
  }

  /**
   * sync the proxy state with the atom
   */
  function onChange(get: Getter, setCb: SetCb) {
    return () => {
      const proxyState = get(proxyRefAtom).current
      if (proxyState === null) return
      const { value } = snapshot(proxyState)
      if (value !== get(atomToSync)) {
        setCb((set) => set(atomToSync, value as Awaited<T>))
      }
    }
  }

  /**
   * create the proxy state and subscribe to it
   */
  function createProxyState(get: Getter, setCb: SetCb) {
    const proxyRef = get(proxyRefAtom)
    const store = get(storeAtom)
    const value = get(atomToSync)
    proxyRef.current ??= proxyFn({ value }) as ProxyState<Value>
    proxyRef.current.value = value as Value
    const unsubscribe = subscribe(proxyRef.current, onChange(get, setCb), sync)
    store.unsubscribe?.()
    store.unsubscribe = () => {
      store.unsubscribe = null
      unsubscribe()
    }
    store.isMounted = true
  }

  /**
   * return the proxy if it exists, otherwise create and subscribe to it
   */
  function ensureProxyState(get: Getter, setCb: SetCb) {
    const proxyRef = get(proxyRefAtom)
    const store = get(storeAtom)
    if (!store.isMounted) createProxyState(get, setCb)
    assert(proxyRef.current !== null)
    return proxyRef.current
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
      const value = get(atomToSync)
      const setCb = makeSetCb(setSelf)
      const proxyState = ensureProxyState(get, setCb)
      // sync the atom with the proxy state
      if (value !== snapshot(proxyState).value) {
        proxyState.value = value as Value
      }
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
  sync: true,
  proxyFn: proxy,
}

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
