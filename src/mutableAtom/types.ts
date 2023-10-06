type Wrapped<T> = { value: T }

type ProxyFn<T> = (obj: Wrapped<T>) => Wrapped<T>

export type Store<Value> = {
  proxyState: ProxyState<Value>
  getValue: () => Value
  setValue: (value: Value) => void
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
