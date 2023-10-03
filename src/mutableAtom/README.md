---
title: Valtio
description: This doc describes Valtio integration.
nav: 4.99
keywords: valtio,proxy
published: false
---

Jotai's state resides in React, but sometimes it would be nice
to interact with the world outside React.

Valtio provides a proxy interface that can be used to store some values
and sync with atoms in Jotai.

This only uses the vanilla api of valtio.

### Install

You have to install `valtio` and `jotai-valtio` to use this feature.

```
npm install valtio jotai-valtio
# or
yarn add valtio jotai-valtio
```

## atomWithProxy

`atomWithProxy` creates a new atom with valtio proxy.
It's two-way binding and you can change the value from both ends.

```jsx
import { useAtom } from 'jotai'
import { atomWithProxy } from 'jotai-valtio'
import { proxy } from 'valtio/vanilla'

const proxyState = proxy({ count: 0 })
const stateAtom = atomWithProxy(proxyState)
const Counter = () => {
  const [state, setState] = useAtom(stateAtom)

  return (
    <>
      count: {state.count}
      <button
        onClick={() =>
          setState((prev) => ({ ...prev, count: prev.count + 1 }))
        }>
        button
      </button>
    </>
  )
}
```

### Parameters

```
atomWithProxy(proxyObject, options?)
```

**proxyObject** (required): the Valtio proxy object you want to derive the atom from

**options.sync** (optional): makes the atom update synchronously instead of waiting for batched updates, similar to [`valtio/useSnapshot`](https://github.com/pmndrs/valtio#update-synchronously). This will result in more renders, but have more guarantees that it syncs with other Jotai atoms.

```
atomWithProxy(proxyObject, { sync: true })
```

### Examples

<CodeSandbox id="ew98ll" />

## mutableAtom

`mutableAtom` wraps a value in a self-aware Valtio proxy. You can make changes to it in the same way you would to a normal js-object.

### API Signature

```jsx
function mutableAtom<Value>(value: Value, options?: Options<Value>): Atom<{ value: Value}>
```

### Parameters

- **value** (required): the value to proxy.
- **options** (optional): allows customization with `proxyFn` for custom proxy functions.

### Example

Count value is stored under the `value` property.

```jsx
const countProxyAtom = mutableAtom<Value>(0)

function IncrementButton() {
  const countProxy = useAtomValue(countProxyAtom)
  return <button onClick={() => countProxy.value++}>+</button>
}
```

<CodeSandbox id="f84sk5" />

### Options

Options include `proxyFn` which can be `proxy` or a custom function.

```jsx
type ProxyFn<Value> = (obj: { value: Value }) => ({ value: Value })

type Options<Value> = {
  proxyFn: ProxyFn<Value>
}
```

### Caution on Mutating Proxies
Be careful not to mutate the proxy directly in the atom's read function or during render in React components. Doing so might trigger an infinite render loop.

```ts
const countProxyAtom = mutableAtom<Value>(0)

atom(
  (get) => {
    const countProxy = get(countProxyAtom)
    countProxy.value++ // This will cause an infinite loop
  },
  (get, set) => {
    const countProxy = get(countProxyAtom)
    countProxy.value++ // This is fine
  }
)
```
