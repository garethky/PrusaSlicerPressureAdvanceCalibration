import Big from "big.js";

export const TickLength = {
    SHORT: 4,
    MEDIUM: 8,
    LONG: 12,
} as const;

const TICK_PATTERN = [TickLength.LONG, TickLength.SHORT, TickLength.SHORT, TickLength.MEDIUM, TickLength.SHORT, TickLength.SHORT];

export function getTickLength(lineIndex: number): number {
    return TICK_PATTERN[lineIndex % TICK_PATTERN.length];
}

// Pure JavaScript business object, encapsulates logic and state we don't want in the UI
export class PressureAdvanceModel {
    #start: Big = new Big(0.0);
    #end: Big = new Big(2.0);
    #step: number = 0.1;
    #lines: Array<number> = [];

    #minLines = 10;
    #maxLines = 30;
    #increments = [100, 50, 25, 10, 5, 2.5, 1, 0.5, 0.25, 0.1, 0.05, 0.025, 0.01, 0.005, 0.002, 0.001];
    
    constructor () {
    }

    #validate(start: number, end: number) {
        if (isNaN(start) || !isFinite(start)) {
            throw "Start value is not a number";
        }
        if (isNaN(end) || !isFinite(end)) {
            throw "End value is not a number";
        }
        if (end < start) {
            throw "End value is less than Start value";
        }
        if ((start + 0.01) > end) {
            throw "Minimum test range is 0.01";
        }
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
                return;  // a solution has been found
            }
        }
        throw "No solution found for input range";
    }

    // mutating function that sets values and re-calculates internal state
    setRange(start: number, end: number) {
        this.#validate(start, end)
        this.#calculateLines(start, end);
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

    get tickLengths(): Array<number> {
        return this.#lines.map((_, index) => getTickLength(index));
    }
}