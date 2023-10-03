import { PromiseAPlus, _resolve, toRejectedState } from '../PromiseAPLus';

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
