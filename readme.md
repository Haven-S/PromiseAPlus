# 用 Typescript 从零到一实现一个符合 Promises/A+规范的自定义 promise.

## 0. Promises/A+ 介绍

#### 0.1. 什么是 Promises/A+

Promises/A+ 是 JavaScript Promise 的一个开放标准。ES6 中的 Promise 就是符合这一规范的。Promises/A+ 提供对所有细节的定义，要构建一个符合规范的 Promise，我们只需按照定义的顺序分步实现即可。

打开 Promises/A+ 的官网，开始我们的实现：

[Promises/A+ (promisesaplus.com)](https://promisesaplus.com/)

#### 0.2. Promises/A+ 是如何定义 Promise 的

> A _promise_ represents the eventual result of an asynchronous operation.
>
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

基础部分搭建完成，接下来我们要处理重要的 `then` 方法了：

#### 2.2 `then` 方法

> A promise must provide a `then` method to access its current or eventual value or reason.

`then` 方法就是用来访问 Promise 的 value 或者 reason 的

`then` 方法的格式：

```javascript
promise.then(onFulfilled, onRejected)
```

它要求提供两个回调函数：`onFulfilled` 和 `onRejected`

`onFulfilled` 和 `onRejected` 都是可选参数，如果它们不是函数，我们要忽略掉。

如果 `onFulfilled` 是函数，在 Promise 转成 fulfilled 状态后要调用它，并且传递 value 给它作为第一个参数。它不能在转成 fulfilled 状态之前被调用，而且不能被多次调用。

`onRejected` 和它类似。

规范 2.2.4. 里要求这两个回调函数要在调用栈里只有 ”platform code“（平台代码）时被调用。这里可能不太好理解，但是通过注释 3.1 我们可以知道，这是在要求它们要被异步执行。这里 Promises/A+ 允许我们使用微任务或者宏任务完成，为了和 ES6 保持相似，我们将要用 Node.js 环境下的 `process.nextTick` 方法来实现。

规范 2.2.5. 还要求这两个函数不能有指定的 `this` 值，这样可以保证回调函数的行为不会受到外部上下文的影响。

先扩充下我们的 PromiseAPlus 定义：

```typescript
const thenObj = Symbol();

interface ThenObj {
  onFulfilled: any;
  onRejected: any;
}

type PromiseAPlusType = (Object | Function) & {
  then: Then;
  [state]: State;
  [value]?: Value;
  [reason]?: Reason;
  [thenObj]: ThenObj;
};

const PromiseAPlus = function (this: PromiseAPlusType) {
  this[state] = State.pending;
  this['then'] = (onFulfilled, onRejected) => { // 传入 onFulfilled, onRejected ，保存在对象内等待调用
    this[thenObj] = {
      onFulfilled,
      onRejected
    };
  };
  this[thenObj] = {
    onFulfilled: null,
    onRejected: null
  };
};

function changeState(promise: PromiseAPlusType, transition: StateTransition) {
  const currentState = promise[state];
  const transitionState = transition.state;
  if (currentState !== State.pending) {
    return;
  }
  promise[state] = transitionState;
  let func, payload;
  if (transitionState === State.fulfilled) {
    promise[value] = transition.payload;
    func = promise[thenObj].onFulfilled;
    payload = promise[value];
  } else {
    promise[reason] = transition.payload;
    func = promise[thenObj].onRejected;
    payload = promise[reason];
  }
  if (func) {
    process.nextTick(func, payload);
  }
}
```

我们用一个 thenObj 来记录 `onFulfilled` 和 `onRejected`，并在合适的时机异步调用。并且我们实现了 then 方法。

但是这样还不够，我们继续看规范：

规范 2.2.6. 指出，`then` 方法可以被多次调用从而挂载多个 `onFulfilled`  `onRejected`。当 Promise 转为 fulfilled 或者 rejected 状态时，所有相关的  `onFulfilled` 或者 `onRejected` 要根据它们挂载的顺序被依次调用。如果 Promise 已经是 fulfilled 或者 rejected 也要调用这两个回调函数。

我们在上面实现的版本只能挂载一个 `onFulfilled` 和 `onRejected` ，而且只有在状态改变的时候会调用它们。在 Promise 已经 fulfilled 或者  rejected 时没有做处理。

规范 2.2.7. 要求 `then` 方法必须返回一个 Promise，这是 `then` 方法能够被链式调用的关键。

```javascript
promise2 = promise1.then(onFulfilled, onRejected);
```

而且我们要在原有的 promise1 对象和返回的 promise2 对象之间建立联系，具体来说，promise2 的状态最终会由 promise1 决定。

当 `onFulfilled`  `onRejected` 是函数：

那么一个函数运行结束，只有两种可能：一是返回了一个值`x`（即便函数体内没有 return 语句，在函数正常运行完后仍然会返回 `undefined` ）,二是在运行中使用`throw`抛出一个异常`e`;

当函数返回了值`x`，用这个值去'解决' promise2 ，即执行 `[[Resolve]](promise2, x)` （ Resolve外的双方括号表示它是一个内部方法 ），我们后面会去实现这个函数。

当函数抛出一个异常`e`，将`e`作为 reason 去拒绝 promise2，把 promise2 状态转为 rejected 。

由此，我们去完善我们的代码：

```typescript
const thenQueue = Symbol(); // 用一个队列记录所有挂载的 thenObj

type PromiseAPlusType = (Object | Function) & {
  then: Then;
  [state]: State;
  [value]?: Value;
  [reason]?: Reason;
  [thenQueue]: ThenObj[];
};

function changeState(promise: PromiseAPlusType, transition: StateTransition) {
  /*
  	省略状态转移代码
  */
  clearThenQueue(promise); // 状态转移成功后尝试清空 then 队列
}

// 封装两个状态转移函数方便调用
const toFulfilledState = (promise: PromiseAPlusType, payload: Value) =>
  changeState(promise, {
    state: State.fulfilled,
    payload
  });
const toRejectedState = (promise: PromiseAPlusType, payload: Reason) =>
  changeState(promise, {
    state: State.rejected,
    payload
  });

interface ThenObj {
  onFulfilled: any;
  onRejected: any;
  returnPromise: PromiseAPlusType; // 记录要返回的 Promise，等待后续操作
}

// 加上构造器签名，用于给 new PromiseAPlus() 调用提供类型
interface PromiseAPlusClass {
  new (): PromiseAPlusType;
  (): void;
} 

function clearThenQueue(promise: PromiseAPlusType) {
  const currentState = promise[state];
  if (currentState === State.pending) { // pending 状态下不能执行回调
    return;
  }
  // 根据现在的状态获取对应的要执行的回调函数名和参数
  const toBeCalled = currentState === State.fulfilled ? 'onFulfilled' : 'onRejected';
  const payload = currentState === State.fulfilled ? promise[value] : promise[reason];
  for (let i = 0; i < promise[thenQueue].length; i++) {
    const { [toBeCalled]: toBeCalledFunc, returnPromise } = promise[thenQueue][i];
    if (typeof toBeCalledFunc === 'function') {
      // onFulfilled 或 onRejected 是函数，尝试执行
      const callback = () => {
        let x;
        try {
          x = toBeCalledFunc(payload);
        } catch (e) {
          // 抛出错误时，用这个错误拒绝之前返回的 Promise
          toRejectedState(returnPromise, e);
          return;
        }
        // 否则，函数正常执行完得到返回值 x，调用内部方法 _resolve，携带参数 x 解决之前返回的 Promise
        _resolve(returnPromise, x);
      };
      process.nextTick(callback);
    } else {
      // onFulfilled 或 onRejected 不是函数，立即将之前返回的 Promise 状态与当前 Promise 同步
      const returnTransition = {
        state: currentState,
        payload
      };
      changeState(returnPromise, returnTransition);
    }
  }
  // 执行回调完毕，队列清空
  promise[thenQueue] = [];
}

function _resolve(promise: PromiseAPlusType, x: Value) {} // resolve 函数，等待后续实现

const PromiseAPlus = function (this: PromiseAPlusType) {
  this[state] = State.pending;
  this['then'] = (onFulfilled, onRejected) => {
    const returnPromise = new PromiseAPlus();
    this[thenQueue].push({
      onFulfilled,
      onRejected,
      returnPromise
    });
    // 每次调用 then 后尝试清空队列，这是为了在 Promise 已经是 fulfilled 或者 rejected 状态下仍然执行回调。
    clearThenQueue(this);
    return returnPromise;
  };
  this[thenQueue] = [];
} as PromiseAPlusClass;
```

至此，我们已经基本实现 `then` 方法。只需要完成内部方法 resolve 的实现，我们就能得到一个符合 Promises/A+ 规范的 Promise 了。