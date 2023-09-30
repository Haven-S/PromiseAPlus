# 用 Typescript 从零到一实现一个符合 Promises/A+规范的自定义 promise.

## 0. Promises/A+ 介绍

#### 0.1. 什么是 Promises/A+

Promises/A+ 是 JavaScript Promise 的一个开放标准。ES6 中的 Promise 就是符合这一规范的。Promises/A+ 提供对所有细节的定义，要构建一个符合规范的 Promise，我们只需按照定义的顺序分步实现即可。

打开 Promises/A+ 的官网，开始我们的实现：

[Promises/A+ (promisesaplus.com)](https://promisesaplus.com/)

#### 0.2. Promises/A+ 是如何定义 Promise 的

> A _promise_ represents the eventual result of an asynchronous operation.
> 一个 Promise 代表着一个异步操作的最终结果。

可以看到，Promise 就是一种异步编程的解决方案。为了获取到 Promise 对象对应的异步操作的结果，Promises/A+ 定义了对象上的 `then` 方法：通过回调函数的方式接收 Promise 的最终结果或者是被拒绝的原因。

Promises/A+ 并不关心 Promise 对象如何创建或者如何更改状态，它只约束 `then` 方法。 所以 `then` 是在我们的实现中要关注的重点。

## 1. 术语

下面我们可以开始编写代码了。

在这个部分，Promises/A+ 定义了 Promise 的常用术语。由于我们使用 Typescript 实现，这里正好可以把它们定义成类型：

```typescript
type PromiseAPlusType = (Object | Function) & { 
  then: Then; // 用 Then 表示 Promises/A+ 定义的 then 方法的类型，我们会在之后定义它
};// Promise 是一个对象或者函数，拥有一个符合 Promises/A+ 规范的 then 方法

type Thenable = (Object | Function) & {
  then: Function;
};// 只要一个对象或者函数实现了一个then方法，那么它就是 "thenable"

type Value = any; // Promise的结果，可以是任意值

type Exception = any; // Exception 是被 throw 抛出的类型，throw 语句可以抛出各种类型的异常

type Reason = any; // Promise的拒绝原因
```

## 2. 要求

#### 2.1 Promise 状态

Promises/A+告诉我们，一个 Promise 必须有状态，而且必须在以下三种之中：

**pending - 待定** 

**fulfilled - 已兑现**

**rejected - 已拒绝**

这可以很方便地用 Typescript 中的 enum 类型定义：

```typescript
enum State {
  pending,
  fulfilled,
  rejected
}
```

接下来是对状态转移的定义：

- 一个 pending 状态的 Promise 可以转成 fulfilled 或者 rejected 状态
- fulfilled 状态下不能再转移状态，而且必须有一个不变的 value
- rejected 状态下不能再转移状态，而且必须有一个不变的 reason

于是我们可以初步定义并且实现我们的 promise 对象：

```typescript
type PromiseAPlusType = (Object | Function) & {
  then: Then;
  state: State;
  value?: Value;
  reason?: Reason;
  // value 和 reason 都是可选的，因为只有在 fulfilled 状态或者 rejected 状态下才需要
};

const PromiseAPlus = function (this: PromiseAPlusType) {
  this.state = State.pending; // 规范里没有约束初始状态，这里我们设置成 pending
};
```

并且提供一个静态方法，用于改变一个 Promise 的状态：

```typescript
// 限制转换成 fulfilled 状态时必须携带 value, 转换成 rejected 状态时必须携带 reason
type StateTransition =
  | {
      state: State.fulfilled;
      payload: Value;
    }
  | {
      state: State.rejected;
      payload: Reason;
    };

function changeState(promise: PromiseAPlusType, transition: StateTransition) {
  const currentState = promise.state;
  const transitionState = transition.state;
  if (currentState !== State.pending) {
    // 只有 pending 状态下可以转换状态
    return;
  }
  promise.state = transitionState;
  if (transitionState === State.fulfilled) {
    promise.value = transition.payload;
  } else {
    promise.reason = transition.payload;
  }
}
```

这样我们就初步完成了与 Promise 状态相关的代码

然而这里有一个问题，规范中对状态转移做了限制，但是如果使用者直接通过 Promise 实例访问 state 属性并且做修改，就像下面这样：

```typescript
let a = new PromiseAPlus();
a.state = 1;
```

那么规范的限制就会失效！我们应该怎样解决这个问题？

其实 state 是一个内部属性，我们不应该允许使用者从外部访问。我们可以用 Symbol 模拟内部属性来解决这个问题：

```typescript
const state = Symbol();
const PromiseAPlus = function (this: PromiseAPlusType) {
  this[state] = State.pending;
};
```

对于 value 和 reason，我们也做一样的修改，最后代码如下：（省略没有变化的代码）

```typescript
const state = Symbol();
const value = Symbol();
const reason = Symbol();

//1. Terminology
type PromiseAPlusType = (Object | Function) & {
  then: Then;
  [state]: State;
  [value]?: Value;
  [reason]?: Reason;
};

function changeState(promise: PromiseAPlusType, transition: StateTransition) {
  const currentState = promise[state];
  const transitionState = transition.state;
  if (currentState !== State.pending) {
    return;
  }
  promise[state] = transitionState;
  if (transitionState === State.fulfilled) {
    promise[value] = transition.payload;
  } else {
    promise[reason] = transition.payload;
  }
}

const PromiseAPlus = function (this: PromiseAPlusType) {
  this[state] = State.pending;
};
```

