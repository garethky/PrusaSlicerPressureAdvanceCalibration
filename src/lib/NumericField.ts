function countDecimals(val: number): number {
    return Math.floor(val) === val ? 0 : val.toString().split(".")[1].length || 0;
}

function truncateDecimals(number: number, digits: number): number {
    const multiplier = Math.pow(10, digits),
        adjustedNum = number * multiplier,
        truncatedNum = Math[adjustedNum < 0 ? 'ceil' : 'floor'](adjustedNum);

    return truncatedNum / multiplier;
}


import { writable } from 'svelte/store';

export class NumericField {
    #token = {};
    #observable = writable(this);
    subscribe = this.#observable.subscribe;
    //update = this.#observable.update;
    //set = this.#observable.set
    notify() {
        this.#observable.set(this);
    }

    #value: string;
    #numericValue: number;
    maxDecimals: number;
    min: number;
    max: number;
    #isValid: boolean = true;
    errors = [];

    constructor(initialValue: number, min: number, max: number, maxDecimals: number) {
        this.min = min;
        this.max = max;
        this.maxDecimals = maxDecimals
        this.#numericValue = initialValue;
        this.#value = '' + this.numericValue;
    }

    // if the value is numeric it can be manipulated with math, even if its not valid
    get isNumeric() {
        return !isNaN(this.#numericValue);
    }

    get isValid() {
        return this.#isValid;
    }

    get numericValue(): number {
        return this.#numericValue;
    }

    set numericValue(numericValue: number) {
        // this will force a re-check of the validation state
        this.value = '' + numericValue;
    }

    increment(by: number) {
        if (!this.isNumeric) {
            throw "NumericField value is not numberic, cannot perform arithamtic on non-numeric value";
        }
        this.value = '' + parseFloat(parseFloat('' + (this.numericValue + by)).toFixed(this.maxDecimals));
        this.notify();
    }

    set value(value: string) {
        this.#value = value;  // value always reflects value in the DOM
        this.#numericValue = NaN;
        this.#isValid = false;

        var valueAsFloat = parseFloat(value);
        // reject things that dont look like real numbers
        this.#isValid = !isNaN(valueAsFloat) && isFinite(valueAsFloat);
        
        if (this.#isValid) {
            // trim decimal places
            if (countDecimals(valueAsFloat) > this.maxDecimals) {
                valueAsFloat = truncateDecimals(valueAsFloat, this.maxDecimals);
            }
            // reject real numbers outside the valid range
            this.#isValid = valueAsFloat >= this.min && valueAsFloat <= this.max;
        }
        // the numeric value can be acessed, even if the field is invalid
        this.#numericValue = valueAsFloat;
        this.notify();
    }

    get value() {
        return this.#value;
    }
}