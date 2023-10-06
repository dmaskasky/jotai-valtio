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
    [ActionWithPayload<'setValue', Value> | Action<'getValue'>],
    void | Value
  >(
    (_get, { setSelf }) => {
      const getValue = () => setSelf({ type: 'getValue' }) as Value
      const store: Store<Value> = {
        proxyState: createProxyState(getValue(), () => store),
        getValue,
        setValue: (value: Value) =>
          setSelf({ type: 'setValue', payload: value }) as void,
      }
      return store
    },
    (get, set, action) => {
      if (action.type === 'setValue') {
        set(valueAtom, { value: action.payload })
      } else if (action.type === 'getValue') {
        return get(valueAtom).value
      }
    }
  )

  if (process.env.NODE_ENV !== 'production') {
    storeAtom.debugPrivate = true
  }

  /**
   * sync the proxy state with the atom
   */
  function onChange(getStore: () => Store<Value>) {
    return () => {
      const { proxyState, getValue, setValue } = getStore()
      const { value } = snapshot(proxyState)
      if (!Object.is(value, getValue())) {
        setValue(value as Awaited<Value>)
      }
    }
  }

  /**
   * create the proxy state and subscribe to it
   */
  function createProxyState(initialValue: Value, getStore: () => Store<Value>) {
    const proxyState = proxyFn({ value: initialValue })
    proxyState.value = initialValue
    subscribe(proxyState, onChange(getStore), true)
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
    const store = get(storeAtom)
    return wrapProxyState(store.proxyState)
  })
  return proxyEffectAtom
}

const defaultOptions = {
  proxyFn: proxy,
}
