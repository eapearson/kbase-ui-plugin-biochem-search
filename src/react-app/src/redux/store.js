// import reducer from "./reducers";
import { createStore, compose, applyMiddleware } from "redux";
import thunk from "redux-thunk";
// import { AppError } from "@kbase/ui-components";
// import { BaseStoreState } from "@kbase/ui-components";
import { makeBaseStoreState } from "@kbase/ui-components";
import { baseReducer } from '@kbase/ui-components';

// export interface StoreState extends BaseStoreState, MyStoreState {
//     // entities: {
//     //     jobs: {
//     //         byId: Map<string, Job>
//     //     }
//     // },
// }

function makeInitialStoreState() {
    const baseState = makeBaseStoreState();
    return {
        ...baseState
    }
}

function reducer(state, action) {
    const baseState = baseReducer(state, action);
    if (baseState) {
        return baseState;
    }
    return state;
}

export function createReduxStore() {
    return createStore(reducer, makeInitialStoreState(), compose(applyMiddleware(thunk)));
}