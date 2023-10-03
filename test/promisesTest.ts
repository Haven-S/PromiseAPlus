import { PromiseAPlus, _resolve, toRejectedState } from '../PromiseAPlus';
import type { Value, Reason } from '../PromiseAPlus';

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
