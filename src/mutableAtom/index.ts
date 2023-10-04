import { atom } from 'jotai'
import type { PrimitiveAtom } from 'jotai'
import { proxy, snapshot, subscribe } from 'valtio'
import type {
  Action,
  ActionWithPayload,
  Options,
  ProxyState,
  Store,
  Wrapped,
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

  const storeAtom = atom<
    Store<Value>,
    [ActionWithPayload<'setValueAsync', Value> | Action<'mount'>],
    void
  >(
    (get, { setSelf }) => ({
      proxyState: null,
      getValue: () => get(valueAtom).value,
      setValue: async (value: Value) => {
        await defer()
        setSelf({ type: 'setValueAsync', payload: value })
      },
    }),
    (get, set, action) => {
      if (action.type === 'setValueAsync') {
        set(valueAtom, { value: action.payload })
      } else if (action.type === 'mount') {
        const store = get(storeAtom)
        store.setValue = (value: Value) => {
          set(valueAtom, { value })
        }
      }
    }
  )

  storeAtom.onMount = (setAtom) => setAtom({ type: 'mount' })

  if (process.env.NODE_ENV !== 'production') {
    storeAtom.debugPrivate = true
  }

  /**
   * sync the proxy state with the atom
   */
  function onChange(getStore: () => Store<Value>) {
    return () => {
      const { proxyState, getValue, setValue } = getStore()
      if (proxyState === null) return
      const { value } = snapshot(proxyState)
      if (value !== getValue()) {
        setValue(value as Awaited<Value>)
      }
    }
  }

  /**
   * create the proxy state and subscribe to it
   */
  function createProxyState(getStore: () => Store<Value>) {
    const store = getStore()
    const value = store.getValue()
    store.proxyState ??= proxyFn({ value })
    store.proxyState.value = value
    subscribe(store.proxyState, onChange(getStore), true)
    return store.proxyState
  }

  /**
   * return the proxy if it exists, otherwise create and subscribe to it
   */
  function ensureProxyState(getStore: () => Store<Value>) {
    const { proxyState } = getStore()
    if (proxyState === null) {
      return createProxyState(getStore)
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
  const proxyEffectAtom = atom<ProxyState<Value>>((get) => {
    get(valueAtom) // subscribe to value updates
    const getStore = () => get(storeAtom)
    const proxyState = ensureProxyState(getStore)
    return wrapProxyState(proxyState)
  })
  return proxyEffectAtom
}

const defaultOptions = {
  proxyFn: proxy,
}

/**
 * delays execution until next microtask
 */
function defer() {
  return Promise.resolve().then()
}
