import Big from "big.js";

// Pure JavaScript business object, encapsulates logic and state we don't want in the UI
export class PressureAdvanceModel {
    #start: Big = new Big(0.0);
    #end: Big = new Big(2.0);
    #step: number = 0.1;
    #lines: Array<number> = [];

    #minLines = 10;
    #maxLines = 30;
    // TODO: with another loop we could start with 3 increments and just multiply them by 10 continuously
    #increments = [100, 50, 25, 10, 5, 2.5, 1, 0.5, 0.25, 0.1, 0.05, 0.025, 0.01, 0.005, 0.002, 0.001];

    
    constructor () {
    }

    #validate(start: number, end: number) {
        if (isNaN(start) || !isFinite(start) 
            || isNaN(end) || !isFinite(end) 
            || (start + 0.01) >= end) {
            throw "start/end values are not number";
        }
        return true;
    }

    #calculateLines(start: number, end: number) {
        this.#start = new Big(start);
        this.#end = new Big(end);
        const range: Big = this.#end.sub(this.#start);
        for (var i = this.#increments.length - 1; i >= 0; i--) {
            const inc = this.#increments[i];
            const lines = range.div(inc).round(0, 3).toNumber();  // computed ceiling
            if (lines >= this.#minLines && lines <= this.#maxLines) {
                this.#step = inc;
                this.#lines = [];
                for (var j = 0; j <= lines; j++) {
                    let lineValue: Big = new Big(j).mul(inc).add(this.#start)
                    this.#lines.push(parseFloat(lineValue.toFixed(3)));
                }
                break;  // break outer loop
            }
        }
    }

    // mutating function that sets values and re-calculates internal state
    setRange(start: number, end: number) {
        if (this.#validate(start, end)) {
            this.#calculateLines(start, end);
            return true;
        } else {
            console.log('range has an error!');
        }
    }

    // non-mutating getters, calling these is not a state change
    get start() {
        return this.#start;
    }

    get end() {
        return this.#end;
    }

    get step() {
        return this.#step;
    }

    get lines() {
        return this.#lines;
    }
}