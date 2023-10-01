//inner symbols
const state = Symbol();
const value = Symbol();
const reason = Symbol();
const thenQueue = Symbol();

//1. Terminology
type PromiseAPlusType = (Object | Function) & {
  then: Then;
  [state]: State;
  [value]?: Value;
  [reason]?: Reason;
  [thenQueue]: ThenObj[];
};
type Thenable = (Object | Function) & {
  then: Then;
};
type Value = any;
type Exception = any;
type Reason = any;

type Then = any;

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

interface ThenObj {
  onFulfilled: any;
  onRejected: any;
  returnPromise: PromiseAPlusType;
}

function clearThenQueue(promise: PromiseAPlusType) {
  const currentState = promise[state];
  if (currentState === State.pending) {
    return;
  }
  const toBeCalled = currentState === State.fulfilled ? 'onFulfilled' : 'onRejected';
  const payload = currentState === State.fulfilled ? promise[value] : promise[reason];
  for (let i = 0; i < promise[thenQueue].length; i++) {
    const { [toBeCalled]: toBeCalledFunc, returnPromise } = promise[thenQueue][i];
    if (typeof toBeCalledFunc === 'function') {
      const callback = () => {
        let x;
        try {
          x = toBeCalledFunc(payload);
        } catch (e) {
          toRejectedState(returnPromise, e);
          return;
        }
        _resolve(returnPromise, x);
      };
      process.nextTick(callback);
    } else {
      const returnTransition = {
        state: currentState,
        payload
      };
      changeState(returnPromise, returnTransition);
    }
  }
  promise[thenQueue] = [];
}

type ResolvePromise = (value?: Value) => any;
type RejectPromise = (reason?: Reason) => any;

function _resolve(promise: PromiseAPlusType, x: Value) {
  if (promise === x) {
    toRejectedState(promise, new TypeError('Chaining cycle detected for promise #<PromiseAPLus>'));
  } else if (x instanceof PromiseAPlus) {
    x[thenQueue].push({
      onFulfilled: null,
      onRejected: null,
      returnPromise: promise
    });
    clearThenQueue(x);
  } else if (Object.prototype.toString.call(x) === '[object Object]' || typeof x === 'function') {
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

interface PromiseAPlusClass {
  new (): PromiseAPlusType;
  (): void;
}

const PromiseAPlus = function (this: PromiseAPlusType) {
  this[state] = State.pending;
  this['then'] = (onFulfilled, onRejected) => {
    const returnPromise = new PromiseAPlus();
    this[thenQueue].push({
      onFulfilled,
      onRejected,
      returnPromise
    });
    //clear queue if not pending
    clearThenQueue(this);
    return returnPromise;
  };
  this[thenQueue] = [];
} as PromiseAPlusClass;
