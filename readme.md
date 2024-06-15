# 用 Typescript 从零到一实现一个符合 Promises/A+规范的自定义 promise.

## 0. Promises/A+ 介绍

#### 0.1. 什么是 Promises/A+

Promises/A+ 是 JavaScript Promise 的一个开放标准。ES6 中的 Promise 就是符合这一规范的。Promises/A+ 提供对所有细节的定义，要构建一个符合规范的 Promise，我们只需按照定义的顺序分步实现即可。

打开 Promises/A+ 的官网，开始我们的实现：

[Promises/A+ (promisesaplus.com)](https://promisesaplus.com/)

强烈建议在阅读本文的同时打开规范以便查阅比对。

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
}; // Promise 是一个对象或者函数，拥有一个符合 Promises/A+ 规范的 then 方法

type Thenable = (Object | Function) & {
  then: Function;
}; // 只要一个对象或者函数实现了一个then方法，那么它就是 "thenable"

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
promise.then(onFulfilled, onRejected);
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
  this['then'] = (onFulfilled, onRejected) => {
    // 传入 onFulfilled, onRejected ，保存在对象内等待调用
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

规范 2.2.6. 指出，`then` 方法可以被多次调用从而挂载多个 `onFulfilled` `onRejected`。当 Promise 转为 fulfilled 或者 rejected 状态时，所有相关的 `onFulfilled` 或者 `onRejected` 要根据它们挂载的顺序被依次调用。如果 Promise 已经是 fulfilled 或者 rejected 也要调用这两个回调函数。

我们在上面实现的版本只能挂载一个 `onFulfilled` 和 `onRejected` ，而且只有在状态改变的时候会调用它们。在 Promise 已经 fulfilled 或者 rejected 时没有做处理。

规范 2.2.7. 要求 `then` 方法必须返回一个 Promise，这是 `then` 方法能够被链式调用的关键。

```javascript
promise2 = promise1.then(onFulfilled, onRejected);
```

而且我们要在原有的 promise1 对象和返回的 promise2 对象之间建立联系，具体来说，promise2 的状态最终会由 promise1 决定。

当 `onFulfilled` `onRejected` 是函数：

那么一个函数运行结束，只有两种可能：一是返回了一个值`x`（即便函数体内没有 return 语句，在函数正常运行完后仍然会返回 `undefined` ）,二是在运行中使用`throw`抛出一个异常`e`;

当函数返回了值`x`，用这个值去'解决' promise2 ，即执行 `[[Resolve]](promise2, x)` （ Resolve 外的双方括号表示它是一个内部方法 ），我们后面会去实现这个函数。

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

type Then = (onFulfilled?: any, onRejected?: any) => PromiseAPlusType;

function changeState(promise: PromiseAPlusType, transition: StateTransition) {
  /*
  	省略状态转移代码
  */
  clearThenQueue(promise); // 状态转移成功后尝试清空 then 队列
}

// 封装两个状态转移函数方便调用
const toFulfilledState = (
  promise: PromiseAPlusType,
  payload: Value // 兑现 promise
) =>
  changeState(promise, {
    state: State.fulfilled,
    payload
  });
const toRejectedState = (
  promise: PromiseAPlusType,
  payload: Reason // 拒绝 promise
) =>
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
  if (currentState === State.pending) {
    // pending 状态下不能执行回调
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
      // 状态同步
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

#### 2.3 Promise 解决过程

`[[Resolve]](promise, x)` 用来'解决'一个 promise：如果 `x` 是一个 thenable （ x 实现了一个 `then` 方法），那么它会尝试让 `promise` 去同步 `x` 的状态, 否则就用 `x` 作为 value 去兑现 `promise`

可以看到，这个方法是在 `onFulfilled` 或者 `onRejected` 成功执行时返回了一个 value `x` 后被调用的。那么现在的问题是，我们为什么需要这样一个方法？我们为什么不直接用 `x` 去兑现 `promise` 呢？'解决' 和 兑现 一个 Promise 有什么区别？

这里我们不妨看看 ES6 里的 Promise:

```javascript
const anotherPromise = new Promise(resolve => {
  setTimeout(() => {
    resolve(2);
  }, 1000);
});

// 第一个例子
Promise.resolve()
  .then(_ => {
    return 1;
  })
  .then(res => {
    console.log(res);
  });
// 第二个例子
Promise.resolve()
  .then(_ => {
    return anotherPromise;
  })
  .then(res => {
    console.log(res);
  });
```

Promise 的一个重要特性就是链式调用。在第一个例子中，我们在第一个 `then` 的回调函数 `onFulfilled` 中返回 1，然后第二个 `then` 中就能接收到这个返回值 1 并且将其打印出来。

然而，在第二个例子里，我们在第一个 `then` 的回调函数中返回一个 Promise，等待一秒后，第二个 `then` 里打印出 2。为什么这里打印的不是回调函数的返回值 Promise 呢？

这就是 `[[Resolve]]` 的作用。

> ```javascript
> promise2 = promise1.then(onFulfilled, onRejected);
> ```
>
> 2.2.7.1 If either `onFulfilled` or `onRejected` returns a value `x`, run the Promise Resolution Procedure `[[Resolve]](promise2, x)`.

在回调函数 `onFulfilled` 或者 `onRejected` 返回一个 value `x` 后，如果 `x` 是普通值，会用 `x` 去兑现 promise2。如果 `x` 是一个 thenable，就会尝试让 promise2 去同步 `x` 的状态。

所以在上面第二个例子里，完整的流程应该是：

```javascript
const anotherPromise = new Promise(resolve => {
  setTimeout(() => {
    resolve(2);
  }, 1000);
});

const promiseA = Promise.resolve().then(_ => {
  // 第一个 then
  return anotherPromise;
});
promiseA.then(res => {
  // 第二个 then
  console.log(res);
});
```

1. anotherPromise 初始化，定时器开启。
2. 第一个 `then` 的 `onFulfilled` 执行并返回 anotherPromise，这时会调用 `[[Resolve]](promiseA,anotherPromise)`，此时 anotherPromise 在 pending 状态， `[[Resolve]]` 会等待 anotherPromise 状态改变。
3. 第二个 `then` 的 `onFulfilled` 加入 promiseA 的等待队列。
4. 一秒后，anotherPromise 被兑现，它的 value 是 2
5. `[[Resolve]]` 发现 anotherPromise 被兑现，将它的状态同步到 promiseA 上。promiseA 被兑现，它的 value 也是 2。
6. promiseA 被兑现，第二个 `then` 的 `onFulfilled` 被执行，拿到 promiseA 的 value，在控制台打印出 2

这样我们就能明白， `[[Resolve]]` 的作用就是同步状态。

```javascript
promise2 = promise1.then(onFulfilled, onRejected);
const onFulfilled = () => {
  return new Promise();
};
```

在 `then` 的回调中如果返回一个 Promise，我们通常关心的不是这个 Promise 本身，而是它的状态，它的 value 或者 reason。所以当回调返回了一个 Promise 对象时，我们用 `[[Resolve]]` 去’解决‘ promise2，去同步 Promise 对象的状态。而不是简单地用这个 Promise 对象兑现 promise2。

此外， `[[Resolve]]` 不仅能同步我们正在实现的这个 Promise 对象的状态，它还能处理其他任何符合 Promises/A+ 规范的 Promise 对象，它甚至可以尝试去同步一个 thenable 对象的状态。这保证了不同的实现之间也能够相互协作。

了解了 `[[Resolve]]` 方法的基本思想，那么接下来规范的细节就更容易理解：

```
[[Resolve]](promise, x)
```

2.3.1. 如果 `promise` 和 `x` 是同一个对象，用一个 `TypeError` 拒绝 `promise`

我们看下 ES6 的 Promise 遇到这种情况会报什么错：

```javascript
let resolveFunc;
let promise = new Promise(resolve => {
  resolveFunc = resolve;
});
promise.catch(err => console.error(err));

resolveFunc(promise);
// TypeError: Chaining cycle detected for promise #<Promise>
```

为什么 `promise` 和 `x` 不能是同一个对象？我们继续看规范：

2.3.2. 如果 `x` 是一个 Promise，去同步它的状态

如果 `x` 在 pending 状态，`promise` 在 `x` 转换状态到 fulfilled 或者 rejected 之前要保持 pending 状态。

这里我们看到，如果 `promise` 和 `x` 是同一个对象，那么它们就会 ’死锁‘ ， 无法转换状态。所以规范里要求在这种情况下拒绝 `promise`。

此外，在 `x` 已经是/转换到 fulfilled 或 rejected 状态时，用 value/reason 兑现/拒绝 `promise`

```typescript
function _resolve(promise: PromiseAPlusType, x: Value) {
  if (promise === x) {
    toRejectedState(promise, new TypeError('Chaining cycle detected for promise #<PromiseAPLus>'));
  } else if (x instanceof PromiseAPlus) {
    // 直接把 promise 加入 x 的 thenQueue，在清空 thenQueue 时 ( clearThenQueue(x) ) ，x 会将自己的状态同步给 promise
    x[thenQueue].push({
      onFulfilled: null,
      onRejected: null,
      returnPromise: promise
    });
    clearThenQueue(x);
  }
}
```

下面我们去处理 thenable 对象：

2.3.3. 如果 x 是一个 object 或者 function

x 上可能存在 `then` 属性

我们首先做一个操作：

```javascript
let then = x.then;
```

由于 x 不是我们定义的类型，它的 `then` 属性可能会在之后被改变。我们需要保存一个固定的引用来确保一致性。

如果在获取 `x.then` 时抛出了一个错误 `e`,用 `e` 去拒绝 `promise` （ 如果 x.then 是一个访问器属性，在它的 get 方法里可能抛出错误 ）

如果 `x` 是一个 function,用 `x` 作为 `this` 去调用它，给它传递两个参数：`resolvePromise ` 和 `rejectPromise`

这两个参数其实就是给这个 thenable 对象提供的状态转移函数。

当 `resolvePromise` 被调用，携带 value `y` 时，调用 `[[Resolve]](promise, y)`

当 `rejectPromise` 被调用，携带 reason `r` 时，用 `r` 拒绝 `promise`

我们要保证所有对 `resolvePromise ` 和 `rejectPromise` 的调用里，只有第一个能够生效。这对应于我们的 Promises/A+ 里对状态转移的限制：只能转移一次。

如果调用 `then` 的过程中抛出错误 `e`：

用 `e` 去拒绝 `promise` ，但是前提是 `resolvePromise` 或者 `rejectPromise` 没有被调用过，也就是这个 thenable 对象没有转移过状态。

如果 `then` 不是一个 function，直接用 `x` 兑现 `promise`

通过以上限制，我们可以保证这个 thenable 至少在行为上是和我们自己的 Promise 一致的。

2.3.3. 如果 x 不是 object 也不是 function，直接用 `x` 兑现 `promise`

```typescript
type ResolvePromise = (value?: Value) => any;
type RejectPromise = (reason?: Reason) => any;

function _resolve(promise: PromiseAPlusType, x: Value) {
  /*
  	省略已经实现的部分
  */
    else if (
    (typeof x === 'object' && !Array.isArray(x) && x !== null) ||
    typeof x === 'function'
  ) {
    let then;
    try {
      then = x.then;
    } catch (e) {
      toRejectedState(promise, e);
      return;
    }
    if (typeof then === 'function') {
      let calledFlag = false; // 记录回调是否已经被调用
      const resolvePromise: ResolvePromise = y => {
        if (!calledFlag) {
          _resolve(promise, y);
        }
        calledFlag = true;
      };
      const rejectPromise: RejectPromise = r => {
        if (!calledFlag) {
          toRejectedState(promise, r);
        }
        calledFlag = true;
      };
      try {
        then.call(x, resolvePromise, rejectPromise);
      } catch (e) {
        if (!calledFlag) {
          toRejectedState(promise, e);
        }
      }
    } else {
      toFulfilledState(promise, x);
    }
  } else {
    toFulfilledState(promise, x);
  }
}
```

大功告成！我们自己实现了一个符合 Promises/A+ 规范的 Promise！

## 4.测试

我们可以简单测试下我们的 Promise：

在我们的 Promise 实现里导出构造函数和状态转移函数：

```typescript
// PromiseAPLus.ts
export { PromiseAPlus, _resolve, toRejectedState };
```

编写一些简单的代码：

```typescript
// test.ts
import { PromiseAPlus, _resolve, toRejectedState } from './PromiseAPLus';

const promise1 = new PromiseAPlus();
promise1
  .then((res: string) => {
    console.log(res);
    throw new Error();
  })
  .then((res: string) => {
    console.log(res);
  })
  .then(
    () => {},
    (err: any) => {
      console.log('caught an error:', err);
    }
  );

setTimeout(() => {
  _resolve(promise1, 'result 1');
}, 2000);

setTimeout(() => {
  toRejectedState(promise1, 'result 2');
}, 3000);

// result 1
// caught an error: Error
```

编译运行下，看起来还不错。有没有办法测试下我们的 Promise 是不是确实符合 Promises/A+ 规范呢？

我们可以用到这样一个 npm 包：promises-aplus-tests，里面已经为我们写好了相关的测试用例。

[promises-aplus/promises-tests: Compliances tests for Promises/A+ (github.com)](https://github.com/promises-aplus/promises-tests#readme)

这个包要求我们提供一个 adapter，它有一个方法 deferred，创建一个 { promise, resolve, reject }，包括一个 Promise 实例，以及 '解决' 和 拒绝它的方法，这正是我们之前在 PromiseAPLus.ts 里导出的方法。

我们还需要从 PromiseAPLus.ts 里导出一些类型：

```typescript
// promisesTest.ts
import { PromiseAPlus, _resolve, toRejectedState } from './PromiseAPlus';
import type { Value, Reason } from './PromiseAPlus';

const adapter = {
  deferred() {
    const promise = new PromiseAPlus();
    const resolve = (value: Value) => _resolve(promise, value);
    const reject = (reason: Reason) => toRejectedState(promise, reason);
    return { promise, resolve, reject };
  }
};

const promisesAplusTests = require('promises-aplus-tests');

promisesAplusTests(adapter, function (err: any) {
  console.log('err:', err);
});
```

编译运行，我们的 Promise 通过了所有测试用例！

## 5. ES6 里的 Promise

#### 5.1. Resolver

Promises/A+ 没有约定 Promise 对象如何创建或者如何更改状态，但是对于使用者来说它们是很重要的。在上面的测试里，我们需要导出三个函数 ( PromiseAPlus, \_resolve, toRejectedState ) 才能完成一个 Promise 对象相关的所有操作，使用起来相当麻烦。

在初始化 ES6 的 Promise 时，我们可以传入一个函数:

```javascript
new Promise((resolve, reject) => {
  console.log(1);
  resolve(2);
});
```

这个函数会被立即执行，而且这个函数会接收到两个参数 resolve 和 reject，用来'解决'或者拒绝当前的 Promise，这个实现非常优雅。

而这个函数一般被称为 Promise 的 resolver ( 有时又被叫做 executor )，下面我们可以给我们自己的 Promise 也加上初始化 resolver 的方法：

```typescript
// MyPromise.ts
import { PromiseAPlus, _resolve, toRejectedState } from './PromiseAPlus';
import type { PromiseAPlusType, Value, Reason } from './PromiseAPlus';

interface MyPromiseClass {
  new (resolver?: Resolver): PromiseAPlusType;
  (resolver?: Resolver): void;
}

type Resolver = (resolve: (value: Value) => void, reject: (reason: Reason) => void) => any;

// 由于这不是 Promises/A+ 规范里的内容，我们不去修改之前的 PromiseAPlus 对象构造函数，而是创建一个新函数
const MyPromise = function (this: PromiseAPlusType, resolver?: Resolver) {
  // 借用之前的 PromiseAPlus 函数
  PromiseAPlus.call(this);
  if (resolver) {
    try {
      resolver(
        // 把'解决'和拒绝的方法传给 resolver
        value => {
          _resolve(this, value);
        },
        reason => {
          toRejectedState(this, reason);
        }
      );
    } catch (e) {
      // resolver 执行时抛出错误要拒绝当前 Promise
      toRejectedState(this, e);
    }
  }
} as MyPromiseClass;
```

#### 5.2. catch 和 finally

除了 `then` 方法，ES6 的 Promise 还提供了两个方法：catch 和 finally。它们和错误处理里的 try ... catch ... finally 语句十分类似。

##### catch

catch 方法要求提供一个回调函数，它在 Promise 被拒绝的时候被调用。

catch 其实就是 `then` 方法的封装，实现起来非常简单：

```typescript
this['catch'] = onRejected => {
  return this.then(null, onRejected);
};
```

##### finally

finally 的功能是设置一个处理程序，在前面的操作完成后调用这个处理程序。

那么我们能不能也像 catch 一样基于 `then` 这样实现呢:

```typescript
this['finally'] = onFinished => {
  return this.then(onFinished, onFinished);
};
```

很可惜，这样做并不完全正确。首先，我们看下 finally 和 `then` 在 ES6 里有什么不一样：

```javascript
let promise = Promise.resolve(1);
promise
  .then(res => {
    console.log('then res:', res);
    return 2;
  })
  .then(res => {
    console.log('then then res:', res);
  });
promise
  .finally(res => {
    console.log('finally res:', res);
    return 2;
  })
  .then(res => {
    console.log('finally then res:', res);
  });
// then res: 1
// finally res: undefined
// then then res: 2
// finally then res: 1
```

这里我们可以看到，finally 和 `then` 有两点不同：

1. finally 的回调函数是没有参数的。这是因为既然 finally 的回调是在 Promise 完成后被调用，它可能获取到最终结果或者是拒绝原因，而在 finally 里是没办法区分这两种情况的，因此干脆就不给它传递任何参数。
2. finally 的回调函数的返回值会被忽略。我们知道在 `then` 的回调里可以给出一个返回值从而传递给下个 `then` 方法，在 finally 里这个返回值并没有被处理。所以最后获取到的值仍然是最开始的 Promise 的值 1。

那么 finally 是如何保证仍然能被链式调用的呢？

```javascript
let promise = Promise.reject(new Error());
let promise1 = promise.then(null, err => {
  console.log('then err:', err);
  return 2;
});
promise1.then(
  res => {
    console.log('then then res:', res);
  },
  err => {
    console.log('then then err:', err);
  }
);
let promise2 = promise.finally(res => {
  console.log('finally res:', res);
  return 2;
});
promise2.then(
  res => {
    console.log('finally then res:', res);
  },
  err => {
    console.log('finally then err:', err);
  }
);
// then err: Error
// finally res: undefined
// then then res: 2
// finally then err: Error
```

我们可以看到，在 promise.then 的 onRejected 返回了一个值后，promise1 被兑现了。

而 promise.finally 的回调返回值被忽略了，promise2 和 promise 的状态一样，都是被拒绝的状态。

```typescript
function getTime(){
    return new Date().getTime();
};
function wait(msec){
    return new Promise((resolve)=>{
        setTimeout(()=>{
            resolve(msec);
        },msec)
    })
}
let promise = Promise.resolve(1);

const startTime = getTime();
promise
  .finally(res => {
    return wait(5000);
  })
  .then(res => {
    const endTime = getTime();
    console.log('time diff:',endTime-startTime,'ms');
    console.log('finally then res:', res);
  });
// time diff: 5002 s
// finally then res: 1
```

这里注意，虽然 finally 的回调被忽略，但如果它返回了一个promise对象，仍然会等待其被兑现或被拒绝。在上面的例子中，.then的回调等待了5000多毫秒才被调用。

这样我们就可以复用 `then` 方法，实现 finally 方法：

```typescript
this['finally'] = onFinished => {
    return this.then(
      (res: Value) => {
        const newPromise = new MyPromise();
        const returnPromise = newPromise.then(() => res);
        _resolve(newPromise, onFinished());
        return returnPromise;
      },
      (err: Reason) => {
        const newPromise = new MyPromise();
        const returnPromise = newPromise.then(() => {
          throw err;
        });
        _resolve(newPromise, onFinished());
        return returnPromise;
      }
    );
```

如果 onFinished 返回 Promise 对象，那么 newPromise 会等待其被兑现或被拒绝。如果 onFinished 抛出错误，`then`方法可以将其正确捕捉。onFinished 的返回值被忽略，finally 方法按原样传递了 Promise 对象的值和状态。



由于我们的 MyPromise 对象新增了 catch 和 finally 方法，那么它的类型也不再应该是 PromiseAPlusType 了。修改类型比较复杂，例如：

在 `then` 方法里创建新的 Promise 对象时，不应该再使用 PromiseAPlus 创建而应该使用当前 Promise 对应的构造函数。

在 resolve 方法判断 x 是不是一个 Promise 对象时，也不应该只判断是不是 PromiseAPlus 的实例 。

这些修改在我们的实现里不是最重要的部分，所以我把修改放在源代码里，这里不再赘述。

除此之外，我们的实现其实和 ES6 有一个细微的差别：我们把 then,catch,finally 方法挂载到了 Promise 实例上。而在 ES6 中，它们都是存在于 Promise 构造函数的原型上的。

#### 5.3. Promise 静态方法

在 ES6 的 `Promise` 类中，有 4 种静态方法:

##### Promise.reject

`Promise.reject(error)` : 使用 error 创建一个 rejected 的 Promise。

```typescript
interface MyPromiseClass {
  reject: (reason?: Reason) => MyPromiseType;
}

MyPromise.reject = function (reason) {
  const newPromise = new MyPromise();
  toRejectedState(newPromise, reason);
  return newPromise;
};
```

##### Promise.resolve

`Promise.resolve(value)` : 创建一个 Promise, 然后用 value '解决' 它。

```typescript
interface MyPromiseClass {
  resolve: (value?: Value) => MyPromiseType;
}

MyPromise.resolve = function (value) {
  const newPromise = new MyPromise();
  _resolve(newPromise, value);
  return newPromise;
};
```

注意，调用 Promise.resolve 不代表一定会得到一个 fulfilled 的 Promise：

```javascript
let newPromise = Promise.resolve(Promise.reject());
```

这样得到的是一个 rejected 的 Promise；

调用 Promise.resolve 返回的 Promise 也可能在 pending 状态：

```javascript
let newPromise = Promise.resolve(
  new Promise(resolve => {
    setTimeout(() => {
      resolve(1);
    }, 1000);
  })
);
```

这样 newPromise 将在 1 秒内保持 pending 状态；

##### Promise.all

`Promise.all(promises)`:返回一个新 Promise。等待所有传入的 promise 都被 '解决' 时，新 Promise 转为 fulfilled ，它的结果是所有传入的 promise 结果的数组。如果任意一个 promise 被拒绝，新 Promise 也会被同样的原因拒绝。

```typescript
interface MyPromiseClass {
  all: (promises: Iterable<any>) => MyPromiseType;
}

MyPromise.all = function (promises) {
  const newPromise = new MyPromise();
  const value = [] as any[];
  let finishedCount = 0; // 记录已经完成的数量
  const promisesArray = Array.from(promises); // promises 是一个可迭代对象，我们把它转成数组方便操作
  if (finishedCount === promisesArray.length) {
    // promises 数组为空，我们可以直接兑现 newPromise
    _resolve(newPromise, value);
  }
  promisesArray.forEach((item, idx) => {
    // promise 数组里可能有不是 MyPromise 类型的值，我们借用 MyPromise.resolve 可以处理它们
    MyPromise.resolve(item).then(
      (res: Value) => {
        value[idx] = res;
        finishedCount++;
        if (finishedCount === promisesArray.length) {
          _resolve(newPromise, value);
        }
      },
      (err: Reason) => {
        toRejectedState(newPromise, err);
      }
    );
  });
  return newPromise;
};
```

我们还可以将整个处理程序用 try...catch... 包裹起来,当出现错误时（例如 promises 不是一个可迭代对象）用其拒绝 newPromise。

##### Promise.race

`Promise.race(promises)` :返回一个新 Promise。等待第一个 fulfilled 或者 rejected 的 promise，并将其状态以及 value / reason 同步给新 Promise。

实现了 Promise.all ，Promise.race 的实现就非常容易完成了：

```typescript
interface MyPromiseClass {
  race: (promises: Iterable<any>) => MyPromiseType;
}

MyPromise.race = function (promises) {
  const newPromise = new MyPromise();
  const promisesArray = Array.from(promises);
  // Promise.race 是不特殊处理 promises 数组为空的情况的
  promisesArray.forEach(item => {
    MyPromise.resolve(item).then(
      (res: Value) => {
        _resolve(newPromise, res);
      },
      (err: Reason) => {
        toRejectedState(newPromise, err);
      }
    );
  });
  return newPromise;
};
```
