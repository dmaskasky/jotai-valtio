import type { Getter, Setter } from 'jotai'

export type Wrapped<T> = { value: T }

type ProxyFn<T> = (obj: Wrapped<T>) => Wrapped<T>

type CleanupFn = () => PromiseOrValue<void>

type Write<Args extends unknown[], Result> = (
  get: Getter,
  set: Setter,
  ...args: Args
) => Result

type SetAtom<Args extends unknown[], Result> = <A extends Args>(
  ...args: A
) => Result

export type WriteFn<Result = PromiseOrValue<void>> = Write<[], Result>

export type PromiseOrValue<T> = Promise<T> | T

export type SetSelf<Args extends unknown[]> = SetAtom<Args, void>

export type Store<Value> = {
  unsubscribe: CleanupFn | null
  isMounted: boolean
  proxyState: ProxyState<Value> | null
}

export type Options<T> = {
  proxyFn?: ProxyFn<T>
}

export type ProxyState<Value> = { value: Value }

export type SetCb = (fn: (set: Setter) => void) => void
