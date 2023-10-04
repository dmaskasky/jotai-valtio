export type Wrapped<T> = { value: T }

type ProxyFn<T> = (obj: Wrapped<T>) => Wrapped<T>

type PromiseOrValue<T> = Promise<T> | T

export type Store<Value> = {
  proxyState: ProxyState<Value> | null
  getValue: () => Value
  setValue: (value: Value) => PromiseOrValue<void>
}

export type Options<T> = {
  proxyFn?: ProxyFn<T>
}

export type ProxyState<Value> = { value: Value }

export type Action<Type extends string> = {
  type: Type
}

export type ActionWithPayload<Type extends string, Payload> = Action<Type> & {
  payload: Payload
}
