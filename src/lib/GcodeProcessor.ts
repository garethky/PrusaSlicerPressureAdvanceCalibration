
export class SettingValue<T> {
    toValue(): T {
        if (this.value !== null) {
            return this.value;
        }
        throw `SettingValue with null value was coerced! (key: ${this.key})`;
    }
    key: string;
    raw: string = '';
    value: T | null = null;
    displayValue: string | null = '';
    errors: Array<string> = [];

    constructor (key: string, raw: string) {
        this.key = key;
        this.raw = raw;
    }
}

type ParserFunction<T> = (value: SettingValue<T>, toolNumber: number | null) => void;
type DescriberFunction<T> = (value: SettingValue<T>) => void;
export class SettingsDescriptor<T> {
    key: string;
    parser: ParserFunction<T>;
    describer: DescriberFunction<T>;
    isRequired: boolean;
    
    constructor (key: string, parser: ParserFunction<T>, describer: DescriberFunction<T>, isRequired: boolean) {
        this.key = key;
        this.parser = parser;
        this.describer = describer;
        this.isRequired = isRequired;
    }
} 
type BedShape = {
    shape: 'Rectangular' | 'Round',
    x: number,
    y: number,
}

export function validateNumberRaw(value: number, errors: Array<string>): void {
    if ((isNaN(value) || !isFinite(value))) {
        errors.push(`Value '${value}' is not a number`);
    }
}

export function _parseInt(raw: string, errors: Array<string>): number {
    let val: number = parseInt(raw, 10);
    validateNumberRaw(val, errors);
    return val;
}

function validateNumber(value: SettingValue<number>): void {
    if (value.value === null) {
        value.errors.push(`Setting '${value.key}' (${value.raw}) is not a number`);
    }
    else if (isNaN(value.value) || !isFinite(value.value)) {
        value.errors.push(`Setting '${value.key}' (${value.raw}) is not a number`);
    }
}

function parseString(value: SettingValue<string>, toolNumber: number | null): void {
    value.value = '' + value.raw;
}

function parseToolString(value: SettingValue<string>, toolNumber: number | null) {
    if (toolNumber == null) {
        value.errors.push(`Can't unpack '${value.key}' (${value.raw}) because the selected tool number is missing`);
        return;
    }
    let toolValues = value.raw.split(';');
    if (toolValues.length < toolNumber) {
        throw `value does not have enough entries for tool #${toolNumber}`;
    }
    const quoteStr = toolValues[toolNumber - 1];
    value.value = quoteStr.substring(1, quoteStr.length - 1);
}

export function parseSingleInt(value: SettingValue<number>, toolNumber: number | null): void {
    if (value.raw === 'nil') {
        return;
    }
    value.value = parseInt(value.raw, 10);
    validateNumber(value);
}


export function parseArrayLength(value: SettingValue<number>, toolNumber: number | null): void {
    if (value.raw === 'nil') {
        return;
    }
    let toolValues = value.raw.split(',');
    value.value = toolValues.length;
    validateNumber(value);
}

export function parseSingleFloat(value: SettingValue<number>, toolNumber: number | null): void {
    if (value.raw === 'nil') {
        return;
    }
    value.value = parseFloat(value.raw);
    validateNumber(value);
}

export function parseToolFloat(value: SettingValue<number>, toolNumber: number | null): void {
    if (toolNumber == null) {
        value.errors.push(`Can't unpack '${value.key}' (${value.raw}) because the selected tool number is missing`);
        return;
    }
    let toolValues = value.raw.split(',');
    if (toolValues.length < toolNumber) {
        throw `Setting ${value.key}'s value '${value.raw}' does not have enough entries for tool #${toolNumber}`;
    }
    let splitValue: string = toolValues[toolNumber - 1]
    if (splitValue === 'nil') {
        return;
    }
    value.value = parseFloat(splitValue);
    validateNumber(value);
}

function parseBedShape(value: SettingValue<BedShape>): void {
    const parts = value.raw.split(',');
    if (parts.length === 4) {
        // Prusa defines the bed as 4 corners, the 3rd entry in the array is the max value for the x and y
        // if the first entry isnt 0x0, bail
        if (parts[0] !== '0x0') {
            value.errors.push('Square bed with non-zero origin found! This is not supported.');
            return;
        }
        let bedMax = parts[2].split('x');
        value.value = {
            shape: 'Rectangular',
            x: _parseInt(bedMax[0], value.errors),
            y: _parseInt(bedMax[1], value.errors),
        }
    } else {
        value.errors.push('Round Beds are not supported yet... sorry delta fans');
        return;
    }
}

export function describeString(value: SettingValue<string>): void {
    value.displayValue = value.value;
}

export function describeNumber(value: SettingValue<number>): void {
    value.displayValue = '' + value.value;
}

export function describePercent(value: SettingValue<number>): void {
    value.displayValue = '' + value.value + ' %';
}

export function describeMms(value: SettingValue<number>): void {
    value.displayValue = '' + value.value + ' mm/s';
}

export function describeMm(value: SettingValue<number>): void {
    value.displayValue = '' + value.value + ' mm';
}

export function describeMmCubed(value: SettingValue<number>): void {
    value.displayValue = '' + value.value + ' mm&sup3;';
}

export function describeMmsSquared(value: SettingValue<number>): void {
    value.displayValue = '' + value.value + ' mm/s&sup2;';
}

export function describeTemp(value: SettingValue<number>): void {
    value.displayValue = '' + value.value + ' &deg;C';
}

export function describeBedShape(value: SettingValue<BedShape>): void {
    value.displayValue = [value.value?.shape, ": ", '' + value.value?.x + "mm x " , '' + value.value?.y, 'mm'].join('');
}

const requiredSettingsDescriptors = {
    perimeter_extruder: new SettingsDescriptor('perimeter_extruder', parseSingleInt, describeNumber, true),
    printer_model: new SettingsDescriptor('printer_model', parseString, describeString, true),
    gcode_flavor: new SettingsDescriptor('gcode_flavor', parseString, describeString, true),
    start_gcode: new SettingsDescriptor('start_gcode', parseString, describeString, true),
    filament_settings_id: new SettingsDescriptor('filament_settings_id', parseToolString, describeString, true),
    bed_shape: new SettingsDescriptor('bed_shape', parseBedShape, describeBedShape, true),
    num_tools: new SettingsDescriptor('nozzle_diameter', parseArrayLength, describeNumber, true),
    nozzle_diameter: new SettingsDescriptor('nozzle_diameter', parseToolFloat, describeMm, true),
    bed_temperature: new SettingsDescriptor('bed_temperature', parseToolFloat, describeTemp, true),
    external_perimeter_extrusion_width: new SettingsDescriptor('external_perimeter_extrusion_width', parseSingleFloat, describeMm, true),
    extrusion_multiplier: new SettingsDescriptor('extrusion_multiplier', parseToolFloat, describeNumber, true),
    temperature: new SettingsDescriptor('temperature', parseToolFloat, describeTemp, true),
    first_layer_temperature: new SettingsDescriptor('first_layer_temperature', parseToolFloat, describeTemp, true),
    filament_diameter: new SettingsDescriptor('filament_diameter', parseToolFloat, describeMm, true),

    // accelerations
    perimeter_acceleration: new SettingsDescriptor('perimeter_acceleration', parseSingleInt, describeMmsSquared, true),
    external_perimeter_acceleration: new SettingsDescriptor('external_perimeter_acceleration', parseSingleInt, describeMmsSquared, true),
    first_layer_acceleration: new SettingsDescriptor('first_layer_acceleration', parseSingleInt, describeMmsSquared, true),
    machine_max_acceleration_extruding: new SettingsDescriptor('machine_max_acceleration_extruding', parseSingleInt, describeMmsSquared, true),
    infill_acceleration: new SettingsDescriptor('infill_acceleration', parseSingleInt, describeMmsSquared, true),
    solid_infill_acceleration: new SettingsDescriptor('solid_infill_acceleration', parseSingleInt, describeMmsSquared, true),
    top_solid_infill_acceleration: new SettingsDescriptor('top_solid_infill_acceleration', parseSingleInt, describeMmsSquared, true),
    travel_acceleration: new SettingsDescriptor('travel_acceleration', parseSingleInt, describeMmsSquared, true),
    default_acceleration: new SettingsDescriptor('default_acceleration', parseSingleInt, describeMmsSquared, true),

    // speeds
    infill_speed: new SettingsDescriptor('infill_speed', parseSingleFloat, describeMms, true),
    solid_infill_speed: new SettingsDescriptor('solid_infill_speed', parseSingleFloat, describeMms, true),
    top_solid_infill_speed: new SettingsDescriptor('top_solid_infill_speed', parseSingleFloat, describeMms, true),
    perimeter_speed: new SettingsDescriptor('perimeter_speed', parseSingleInt, describeMms, true),
    travel_speed: new SettingsDescriptor('travel_speed', parseSingleInt, describeMms, true),

    perimeter_extrusion_width: new SettingsDescriptor('perimeter_extrusion_width', parseSingleFloat, describeMm, true),
    travel_speed_z: new SettingsDescriptor('travel_speed_z', parseSingleInt, describeMms, true),

    // retractions
    retract_length: new SettingsDescriptor('retract_length', parseToolFloat, describeMm, true),
    retract_restart_extra: new SettingsDescriptor('retract_restart_extra', parseToolFloat, describeMm, true),
    retract_speed: new SettingsDescriptor('retract_speed', parseToolFloat, describeMms, true),
    deretract_speed: new SettingsDescriptor('deretract_speed', parseToolFloat, describeMms, true),
    retract_lift: new SettingsDescriptor('retract_lift', parseToolFloat, describeMm, true),
    // filament retraction overrides
    filament_retract_length: new SettingsDescriptor('filament_retract_length', parseToolFloat, describeMm, false),
    filament_retract_restart_extra: new SettingsDescriptor('retract_restart_extra', parseToolFloat, describeMm, false),
    filament_retract_speed: new SettingsDescriptor('filament_retract_speed', parseToolFloat, describeMms, false),
    filament_deretract_speed: new SettingsDescriptor('filament_deretract_speed', parseToolFloat, describeMms, false),
    filament_retract_lift: new SettingsDescriptor('filament_retract_lift', parseToolFloat, describeMm, false),

    layer_height: new SettingsDescriptor('layer_height', parseSingleFloat, describeMm, true),
    disable_fan_first_layers: new SettingsDescriptor('disable_fan_first_layers', parseToolFloat, describeNumber, true),
    first_layer_speed: new SettingsDescriptor('first_layer_speed', parseSingleFloat, describeMms, true),
    min_fan_speed: new SettingsDescriptor('min_fan_speed', parseToolFloat, describePercent, true),

    max_volumetric_speed: new SettingsDescriptor('max_volumetric_speed', parseSingleFloat, describeMmCubed, true),
    filament_max_volumetric_speed: new SettingsDescriptor('filament_max_volumetric_speed', parseToolFloat, describeMmCubed, false),
} as const;

type RequiredSettingsDescriptorMap = typeof requiredSettingsDescriptors;
type DescriptorValue<T> = T extends SettingsDescriptor<infer U> ? U : never;
export type RequiredSettingKey = keyof RequiredSettingsDescriptorMap;
export type RequiredSettingsValues = {
    [K in RequiredSettingKey]: SettingValue<DescriptorValue<RequiredSettingsDescriptorMap[K]>>;
};


export function valueFromSetting<T>(foundSettings: Map<string, string>,
                                    descriptor: SettingsDescriptor<T>,
                                    toolNumber: number | null,
                                    allErrors: Array<Array<string>> = [],
                                    allSettings: Array<SettingValue<any>> = []): SettingValue<T> {
    let val: SettingValue<T> = new SettingValue<T>(descriptor.key, '');
    val.displayValue = '';

    if (foundSettings.has(descriptor.key)) {
        val = new SettingValue<T>(descriptor.key, '' + foundSettings.get(descriptor.key));
        descriptor.parser(val, toolNumber);
        if (val.value !== null) {
            descriptor.describer(val);
        }
    }
    if (val.value === null && descriptor.isRequired) {
        val.errors.push('Required setting not found');
    }
    allErrors.push(val.errors);
    allSettings.push(val); // makes it easy for the front end to iterate over all settings
    return val;
}

export class RequiredSlicerSettings {
    hasAllSettings = true;
    hasErrors = false;
    errorCount = 0;
    errors: Array<string> = []
    #allErrors: Array<Array<string>> = [];
    allSettings: Array<SettingValue<any>> = []
    settings: RequiredSettingsValues;
    toolNumber: number | null;

    constructor(foundSettings: Map<string, string>, toolNumber: number | null = null) {
        this.toolNumber = toolNumber;
        const resolvedSettings = {} as RequiredSettingsValues;
        const keys = Object.keys(requiredSettingsDescriptors) as RequiredSettingKey[];
        const resolveSetting = <K extends RequiredSettingKey>(key: K): RequiredSettingsValues[K] => {
            const descriptor = requiredSettingsDescriptors[key] as SettingsDescriptor<DescriptorValue<RequiredSettingsDescriptorMap[K]>>;
            return valueFromSetting(foundSettings, descriptor, this.toolNumber, this.#allErrors, this.allSettings) as RequiredSettingsValues[K];
        };
        const assignSetting = <K extends RequiredSettingKey>(key: K, value: RequiredSettingsValues[K]) => {
            resolvedSettings[key] = value;
        };
        for (const key of keys) {
            const val = resolveSetting(key);
            if (this.#allErrors[this.#allErrors.length - 1].length > 0) {
                this.hasAllSettings = false;
            }
            assignSetting(key, val);
        }
        this.settings = resolvedSettings;
        this.#allErrors.forEach(val => { this.errors.push(...val) });
        this.errorCount = this.errors.length;
        this.hasErrors = this.errorCount > 0;
    }

    // Access settings via this.settings to keep key usage type-safe.
}

/**
 * Class responsible for:
 *  - splitting the GCode file into lines
 *  - identifying all of the settings in the settings block
 *  - identifying the start and end gcode
 *  - holding the above as state.
 *  - cleaning out any 'proprietary' Prusa comments 🤬🤬
 */
export class GcodeProcessor {
    allLines: Array<string> = [];
    startLines: Array<string> = [];
    endLines: Array<string> = [];
    toolNumber: number = 1;
    fileName: string = '';
    fileExtension: string = '';
    rawSettings: Map<string, string> = new Map();
    requiredSettings: RequiredSlicerSettings | null = null;

    errors: Array<string> = [];

    constructor(file: File, onComplete: () => void) {
        this.fileName = file.name;
        this.fileExtension = this.#extractExtension();
        const reader = new FileReader();
        let self = this;

        if (this.fileExtension === '.bgcode') {
            file.arrayBuffer().then((data) => { 
                const gcodeString = Module.bgcode2ascii_and_verify(data);
                self.#processContents(gcodeString);
                onComplete();
            });
        } else {
        reader.onload = function(event) {
                if (event && event.target && event.target.result) {
                    let blob = event.target.result;
                    let gcodeString = '';
                    if (blob instanceof ArrayBuffer) {
                        gcodeString = new TextDecoder().decode(blob);
                    } else {
                        gcodeString = blob;
                    }
                    self.#processContents(gcodeString);
                    onComplete();
                }
            };
            reader.readAsText(file);
        }
    }

    #extractExtension(): string {
        let dotIndex = this.fileName.lastIndexOf('.');
        return this.fileName.substring(dotIndex);
    }

    #processContents(gcode: string) {
        this.allLines = gcode.split(/\r?\n/);
        this.allLines = this.#stripTypeCustom();
        this.rawSettings = this.#extractPrusaSlicerSettings();
        this.toolNumber = this.#findToolNumber();
        this.requiredSettings = new RequiredSlicerSettings(this.rawSettings, this.toolNumber);
        this.startLines = this.#findStartGcode();
        this.endLines = this.#findEndGcode();
    }

    #stripTypeCustom() {
        // for some reason, if you leave this comment in the source, Prusa's GCode viewer wont open it.
        return this.allLines.filter(line => line !== ";TYPE:Custom");
    }

    #extractPrusaSlicerSettings(): Map<string, string> {
        const setting_regex = new RegExp(/^; ([a-z0-9_]+) = (.+)$/);
        const settings = new Map<string, string>();
        // for every line:
        for (var i = 0; i < this.allLines.length; i++) {
            var line = this.allLines[i];
            var results = setting_regex.exec(line);
            if (results !== null) {
                settings.set(results[1], results[2]);
            }
        }
        return settings;
    }

    #findStartGcode(): Array<string> {
        for (var i = 0; i < this.allLines.length; i++) {
            const line = this.allLines[i];
            if (line === ";AFTER_LAYER_CHANGE"
                || line === ";LAYER_CHANGE"
                || line === ";START_GCODE_END") {
                return this.allLines.slice(0, i);
            }
        }
        this.errors.push("Could not find the last line of the 'Start G-code' block. Missing <code>;AFTER_LAYER_CHANGE</code>, <code>;LAYER_CHANGE</code> or <code>;START_GCODE_END</code> comment. Check in the printers custom gcode settings.");
        return [];
    }
    
    #findEndGcode(): Array<string>  {
        for (var i = this.allLines.length - 1; i > 0; i--) {
            const line = this.allLines[i];
            if (line === "; Filament-specific end gcode") {
                return this.allLines.slice(i);
            }
        }
        this.errors.push("Could not find the first line of the end gcode block. Missing <code>; Filament-specific end gcode</code> comment. Check in the filaments custom gcode settings.");
        return [];
    }

    #findToolNumber(): number {
        const tool_pattern = new RegExp(/^\s*T(\d+)(?:\s|$)/);
        for (var i = this.allLines.length - 1; i > 0; i--) {
            const line = this.allLines[i];
            const match = line.match(tool_pattern)
            if (match !== null && match?.length == 2) {
                return parseInt(match[1])
            }
        }
        return 1;
    }

    get hasErrors(): boolean {
        return this.errors.length > 0 || this.requiredSettings == null || this.requiredSettings.hasErrors;
    }
}

import { writable } from "svelte/store";
import type { TestPatternConfiguration } from "./TestPatternConfiguration";

function createGCodeProcessorStore() {
    const { subscribe, set, update } = writable<GcodeProcessor | null>(null);

    // called when the file has been parsed, this triggers a notification on the store
    function onComplete() {
        update((val) => val);
    }

    function parseFile(file: File) {
        set(new GcodeProcessor(file, onComplete));
    }

    return {
        subscribe,
        parseFile,
    };
}

export const gcodeStore = createGCodeProcessorStore();
