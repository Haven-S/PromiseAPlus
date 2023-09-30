//inner symbols
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
}

const PromiseAPlus = function (this: PromiseAPlusType) {
  this[state] = State.pending;
};
