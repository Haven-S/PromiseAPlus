//inner symbols
const state = Symbol();
const value = Symbol();
const reason = Symbol();
export const thenQueue = Symbol();

//1. Terminology
export type PromiseAPlusType = {
  then: Then<PromiseAPlusType>;
  [state]: State;
  [value]?: Value;
  [reason]?: Reason;
  [thenQueue]: ThenObj<PromiseAPlusType>[];
};
// type Thenable = (Object | Function) & {
//   then: Then;
// };
export type Value = any;
// type Exception = any;
export type Reason = any;

export type Then<R> = (onFulfilled?: any, onRejected?: any, isFinally?: boolean) => R;

// 2. Requirements
enum State {
  pending,
  fulfilled,
  rejected
}

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
  clearThenQueue(promise);
}

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

export interface ThenObj<T extends PromiseAPlusType> {
  onFulfilled: any;
  onRejected: any;
  returnPromise: T;
  isFinally?: boolean;
}

function clearThenQueue(promise: PromiseAPlusType) {
  const currentState = promise[state];
  if (currentState === State.pending) {
    return;
  }
  const toBeCalled = currentState === State.fulfilled ? 'onFulfilled' : 'onRejected';
  const payload = currentState === State.fulfilled ? promise[value] : promise[reason];
  for (let i = 0; i < promise[thenQueue].length; i++) {
    const { [toBeCalled]: toBeCalledFunc, returnPromise, isFinally } = promise[thenQueue][i];
    if (typeof toBeCalledFunc === 'function') {
      const callback = () => {
        let x;
        try {
          x = toBeCalledFunc(payload);
        } catch (e) {
          toRejectedState(returnPromise, e);
          return;
        }
        if (isFinally) {
          changeState(returnPromise, {
            state: currentState,
            payload
          });
        } else {
          _resolve(returnPromise, x);
        }
      };
      process.nextTick(callback);
    } else {
      changeState(returnPromise, {
        state: currentState,
        payload
      });
    }
  }
  promise[thenQueue] = [];
}

type ResolvePromise = (value?: Value) => any;
type RejectPromise = (reason?: Reason) => any;

function _resolve<T extends PromiseAPlusType>(promise: T, x: Value) {
  if (promise === x) {
    toRejectedState(promise, new TypeError('Chaining cycle detected for promise #<PromiseAPLus>'));
  } else if (x instanceof (promise.constructor as PromiseClass<T>)) {
    x[thenQueue].push({
      onFulfilled: null,
      onRejected: null,
      returnPromise: promise
    });
    clearThenQueue(x);
  } else if (
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
      let calledFlag = false;
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

interface PromiseClass<T extends PromiseAPlusType> {
  new (): T;
  (): void;
}

function then<T extends PromiseAPlusType>(
  this: T,
  onFulfilled?: any,
  onRejected?: any,
  isFinally: boolean = false
): T {
  const returnPromise = new (this.constructor as PromiseClass<T>)();
  const newObj = {
    onFulfilled,
    onRejected,
    returnPromise
  } as ThenObj<T>;
  if (isFinally) {
    newObj.isFinally = true;
  }
  this[thenQueue].push(newObj);
  clearThenQueue(this);
  return returnPromise;
}

function CreatePromise<T extends PromiseAPlusType>(this: T) {
  this[state] = State.pending;
  this['then'] = then<T>;
  this[thenQueue] = [];
}

const PromiseAPlus = CreatePromise<PromiseAPlusType> as PromiseClass<PromiseAPlusType>;

export { PromiseAPlus, _resolve, toRejectedState };
