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

## withProxyEffect

`withProxyEffect` wraps a primitive atom’s value in a self-aware Valtio proxy. You can make changes to it in the same way you would to a normal js-object.

### API Signature

```jsx
function withProxyEffect<Value>(atomToSync: PrimitiveAtom<Value>, options?: Options<Value>): Atom<{ value: Value}>
```

### Parameters

- **atomToSync** (required): the primitive atom to sync.
- **options** (optional): allows customization with `sync` for synchronous updates and `proxyFn` for custom proxy functions.

### Example

Count value is stored under the `value` property.

```jsx
const countAtom = atom(0)
const proxyCountAtom = withProxyEffect < Value > countAtom

function IncrementButton() {
  const proxyCount = useAtomValue(proxyCountAtom)
  return <button onClick={() => proxyCount.value++}>+</button>
}
```

### Options

Options include `sync` for determining synchronous updates and `proxyFn` which can be `proxy`, `proxySet`, `proxyMap`, or a custom function.

```jsx
type ProxyFn<Value> = (obj: { value: Value }) => ({ value: Value })

type Options<Value> = {
  sync: boolean
  proxyFn: ProxyFn<Value>
}
```
