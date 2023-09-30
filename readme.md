# 用Typescript从零到一实现一个符合Promises/A+规范的自定义promise.

## 0. Promises/A+介绍

#### 0.1. 什么是Promises/A+

Promises/A+ 是  JavaScript Promise 的一个开放标准。ES6 中的 Promise 就是符合这一规范的。Promises/A+ 提供对所有细节的定义，要构建一个符合规范的 Promise，我们只需按照定义的顺序分步实现即可。

打开 Promises/A+ 的官网，开始我们的实现：
[Promises/A+ (promisesaplus.com)](https://promisesaplus.com/)

#### 0.2. Promises/A+ 是如何定义 Promise 的

> A *promise* represents the eventual result of an asynchronous operation.
> 一个 Promise 代表着一个异步操作的最终结果。

可以看到，Promise 就是一种异步编程的解决方案。为了获取到 Promise 对象对应的异步操作的结果，Promises/A+ 定义了对象上的 `then` 方法：通过回调函数的方式接收 Promise 的最终结果或者是被拒绝的原因。

Promises/A+ 并不关心 Promise 对象如何创建或者如何更改状态，它只约束 `then` 方法。 所以 `then` 也是在我们的实现中要关注的重点。