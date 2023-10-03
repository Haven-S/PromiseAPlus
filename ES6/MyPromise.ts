import { PromiseAPlus, _resolve, toRejectedState, thenQueue } from '../PromiseAPlus';
import type { PromiseAPlusType, Value, Reason, Then, ThenObj } from '../PromiseAPlus';

type MyPromiseType = Omit<PromiseAPlusType, 'then' | keyof { [thenQueue]: any }> & {
  then: Then<MyPromiseType>;
  catch: (onRejected?: any) => MyPromiseType;
  finally: (onFinished?: any) => MyPromiseType;
  [thenQueue]: ThenObj<MyPromiseType>[];
};

interface MyPromiseClass {
  new (resolver?: Resolver): MyPromiseType;
  (resolver?: Resolver): void;
  resolve: (value?: Value) => MyPromiseType;
  reject: (reason?: Reason) => MyPromiseType;
  all: (promises: Iterable<any>) => MyPromiseType;
  race: (promises: Iterable<any>) => MyPromiseType;
}

type Resolver = (resolve: (value: Value) => void, reject: (reason: Reason) => void) => any;

export const MyPromise = function (this: MyPromiseType, resolver?: Resolver) {
  PromiseAPlus.call(this);
  this['catch'] = onRejected => {
    return this.then(null, onRejected);
  };
  this['finally'] = onFinished => {
    return this.then(
      (res: Value) => {
        onFinished();
      },
      (err: Reason) => {
        onFinished();
      },
      true
    );
  };
  if (resolver) {
    try {
      resolver(
        value => {
          _resolve(this, value);
        },
        reason => {
          toRejectedState(this, reason);
        }
      );
    } catch (e) {
      toRejectedState(this, e);
    }
  }
} as MyPromiseClass;

MyPromise.reject = function (reason) {
  const newPromise = new MyPromise();
  toRejectedState(newPromise, reason);
  return newPromise;
};

MyPromise.resolve = function (value) {
  const newPromise = new MyPromise();
  _resolve(newPromise, value);
  return newPromise;
};

MyPromise.all = function (promises) {
  const newPromise = new MyPromise();
  const value = [] as any[];
  let finishedCount = 0;
  const promisesArray = Array.from(promises);
  if (finishedCount === promisesArray.length) {
    _resolve(newPromise, value);
  }
  promisesArray.forEach((item, idx) => {
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

MyPromise.race = function (promises) {
  const newPromise = new MyPromise();
  const promisesArray = Array.from(promises);
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
