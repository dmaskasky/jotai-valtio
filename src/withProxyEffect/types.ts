import { Getter, Setter } from 'jotai'
import type { SetStateAction } from 'jotai/vanilla'

type Ref<T> = { current: T }

type Wrapped<T> = { value: T }

type ProxyFn<T> = (obj: Wrapped<T>) => Wrapped<T>

type CleanupFn = () => PromiseOrValue<void>

type Write<Args extends unknown[], Result> = (
  get: Getter,
  set: Setter,
  ...args: Args
) => Result

export type WriteFn<Result = PromiseOrValue<void>> = Write<[], Result>

export type ExtractFromSetStateAction<T> = T extends SetStateAction<infer U>
  ? U
  : never

export type SetAtom<Args extends unknown[], Result> = <A extends Args>(
  ...args: A
) => Result

export type PromiseOrValue<T> = Promise<T> | T

export type SetSelf<Args extends unknown[]> = SetAtom<Args, void>

export type Store = {
  unsubscribe: CleanupFn | null
  isMounted: boolean
}

export type Options<T> = {
  sync?: boolean
  proxyFn?: ProxyFn<T>
}

export type ProxyState<Value> = { value: Value }

export type ProxyRef<Value> = Ref<ProxyState<Value> | null>

export type SetCb = (fn: (set: Setter) => void) => void
