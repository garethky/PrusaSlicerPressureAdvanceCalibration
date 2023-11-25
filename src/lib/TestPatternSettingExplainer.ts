import type { SettingValue } from "./GcodeProcessor";

export class ExplanationStartGCode {
    value: string;
    constructor(value: string) {
        this.value = value;
    }
}

export class ExplanationMaxOf {
    maxOf: Array<SettingValue<any>>;
    selected: SettingValue<any>;
    constructor(maxOf: Array<SettingValue<any>>, selected: SettingValue<any>) {
        this.maxOf = maxOf;
        this.selected = selected;
    }
}

export class ExplanationSumOf {
    sumOf: Array<SettingValue<any>>;
    constructor(sumOf: Array<SettingValue<any>>) {
        this.sumOf = sumOf;
    }
}

export class ExplanationVolumetricFlow {
    speeds: Array<SettingValue<any>>;
    flows: Array<SettingValue<any>>;
    requestedFlow: string;
    actualFlow: string;
    constructor( speeds: Array<SettingValue<any>>, flows: Array<SettingValue<any>>, requestedFlow: string, actualFlow: string) {
        this.speeds = speeds;
        this.flows = flows;
        this.requestedFlow = requestedFlow;
        this.actualFlow = actualFlow;
    }
}

export class ExplanationFanSpeed {
    fanSpeed: number;
    minFanSpeed: SettingValue<number>;
    fanOffLayers: SettingValue<number>;
    constructor(fanSpeed: number, minFanSpeed: SettingValue<number>, fanOffLayers: SettingValue<number>) {
        this.fanSpeed = fanSpeed,
        this.minFanSpeed = minFanSpeed;
        this.fanOffLayers = fanOffLayers;
    }
}

export class ExplanationPaGcode {
    gcodeFlavor: SettingValue<string>;
    printerModel: SettingValue<string>;

    constructor (gcodeFlavor: SettingValue<string>, printerModel: SettingValue<string>) {
        this.gcodeFlavor = gcodeFlavor;
        this.printerModel = printerModel;
    }
}

export class ExplanationArray {
    values: Array<number>;
    constructor(values: Array<number>) {
        this.values = values;
    }
}

export type Explanation = ExplanationArray | ExplanationSumOf | ExplanationMaxOf | ExplanationStartGCode | ExplanationVolumetricFlow | ExplanationFanSpeed | ExplanationPaGcode | SettingValue<any> | string;