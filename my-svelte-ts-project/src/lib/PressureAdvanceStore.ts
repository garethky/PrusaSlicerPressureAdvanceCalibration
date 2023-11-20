import { readable, writable } from 'svelte/store';
import { PressureAdvanceModel } from './PressureAdvanceModel';

function createPressureAdvanceStore(paModel: PressureAdvanceModel) {
    const { subscribe, set, update } = writable(paModel);
    // we dont need the writable because we will never change the underlying object

    function notify() {
        // setting the value to an object causes Svelte to notify all subscribers
        // even if that object is the same object
        // since `paModel` can in via the constructor we can reference it dorectly here
        set(paModel);
    }

    // wrap calls to a mutating operation on the model so they notify subscribers
    function mutator(fn: Function) {
        return (...args: any) => {
            fn.call(paModel, ...args);
            notify();
        }
    }
    
    return {
        subscribe,
        setRange: mutator(paModel.setRange),
        // non-mutating operations dont need the wrapper
        // but you are certifing that these are infact side-effect free
        start: paModel.start,
        end: paModel.end,
        step: paModel.step,
        lines: paModel.lines,
    };
}

export const pressureAdvanceStore = createPressureAdvanceStore(new PressureAdvanceModel());