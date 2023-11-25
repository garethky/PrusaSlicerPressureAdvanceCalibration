
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
class SettingsDescriptor<T> {
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

function validateNumberRaw(value: number, errors: Array<string>): void {
    if ((isNaN(value) || !isFinite(value))) {
        errors.push(`Value '${value}' is not a number`);
    }
}

function _parseInt(raw: string, errors: Array<string>): number {
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
        value.errors.push(`Can't unpack '${value.key}' (${value.raw}) because the setting for 'primary_extruder' is missing`);
        return;
    }
    let toolValues = value.raw.split(';');
    if (toolValues.length < toolNumber) {
        throw `value does not have enough entries for tool #${toolNumber}`;
    }
    const quoteStr = toolValues[toolNumber - 1];
    value.value = quoteStr.substring(1, quoteStr.length - 1);
}

function parseSingleInt(value: SettingValue<number>, toolNumber: number | null): void {
    value.value = parseInt(value.raw, 10);
    validateNumber(value);
}

function parseSingleFloat(value: SettingValue<number>, toolNumber: number | null): void {
    value.value = parseFloat(value.raw);
    validateNumber(value);
}

function parseToolFloat(value: SettingValue<number>, toolNumber: number | null): void {
    if (toolNumber == null) {
        value.errors.push(`Can't unpack '${value.key}' (${value.raw}) because the setting for 'primary_extruder' is missing`);
        return;
    }
    let toolValues = value.raw.split(',');
    if (toolValues.length < toolNumber) {
        throw `Setting ${value.key}'s value '${value.raw}' does not have enough entries for tool #${toolNumber}`;
    }
    let splitValue: string = toolValues[toolNumber - 1]
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

function describeString(value: SettingValue<string>): void {
    value.displayValue = value.value;
}

function describeNumber(value: SettingValue<number>): void {
    value.displayValue = '' + value.value;
}

function describePercent(value: SettingValue<number>): void {
    value.displayValue = '' + value.value + ' %';
}

function describeMms(value: SettingValue<number>): void {
    value.displayValue = '' + value.value + ' mm/s';
}

function describeMm(value: SettingValue<number>): void {
    value.displayValue = '' + value.value + ' mm';
}

function describeMmCubed(value: SettingValue<number>): void {
    value.displayValue = '' + value.value + ' mm&sup3;';
}

function describeMmsSquared(value: SettingValue<number>): void {
    value.displayValue = '' + value.value + ' mm/s&sup2;';
}

function describeTemp(value: SettingValue<number>): void {
    value.displayValue = '' + value.value + ' &deg;C';
}

function describeBedShape(value: SettingValue<BedShape>): void {
    value.displayValue = [value.value?.shape, ": ", '' + value.value?.x + "mm x " , '' + value.value?.y, 'mm'].join('');
}

class RequiredSettingsDescriptors {
    perimeter_extruder: SettingsDescriptor<number> = new SettingsDescriptor('perimeter_extruder', parseSingleInt, describeNumber, true);
    printer_model: SettingsDescriptor<string> = new SettingsDescriptor('printer_model', parseString, describeString, true);
    gcode_flavor: SettingsDescriptor<string> = new SettingsDescriptor('gcode_flavor', parseString, describeString, true);
    start_gcode: SettingsDescriptor<string> = new SettingsDescriptor('start_gcode', parseString, describeString, true);
    filament_settings_id: SettingsDescriptor<string> = new SettingsDescriptor('filament_settings_id', parseToolString, describeString, true);
    bed_shape: SettingsDescriptor<BedShape> = new SettingsDescriptor('bed_shape', parseBedShape, describeBedShape, true);
    nozzle_diameter: SettingsDescriptor<number> = new SettingsDescriptor('nozzle_diameter', parseToolFloat, describeMm, true);
    bed_temperature: SettingsDescriptor<number> = new SettingsDescriptor('bed_temperature', parseToolFloat, describeTemp, true);
    external_perimeter_extrusion_width: SettingsDescriptor<number> = new SettingsDescriptor('external_perimeter_extrusion_width', parseSingleFloat, describeMm, true);
    extrusion_multiplier: SettingsDescriptor<number> = new SettingsDescriptor('extrusion_multiplier', parseToolFloat, describeNumber, true);
    temperature: SettingsDescriptor<number> = new SettingsDescriptor('temperature', parseToolFloat, describeTemp, true);
    first_layer_temperature: SettingsDescriptor<number> = new SettingsDescriptor('first_layer_temperature', parseToolFloat, describeTemp, true);
    filament_diameter: SettingsDescriptor<number> = new SettingsDescriptor('filament_diameter', parseToolFloat, describeMm, true);
    
    // accelerations
    perimeter_acceleration: SettingsDescriptor<number> = new SettingsDescriptor('perimeter_acceleration', parseSingleInt, describeMmsSquared, true);
    external_perimeter_acceleration: SettingsDescriptor<number> = new SettingsDescriptor('external_perimeter_acceleration', parseSingleInt, describeMmsSquared, true);
    first_layer_acceleration: SettingsDescriptor<number> = new SettingsDescriptor('first_layer_acceleration', parseSingleInt, describeMmsSquared, true);
    machine_max_acceleration_extruding: SettingsDescriptor<number> = new SettingsDescriptor('machine_max_acceleration_extruding', parseSingleInt, describeMmsSquared, true);
    infill_acceleration: SettingsDescriptor<number> = new SettingsDescriptor('infill_acceleration', parseSingleInt, describeMmsSquared, true);
    solid_infill_acceleration: SettingsDescriptor<number> = new SettingsDescriptor('solid_infill_acceleration', parseSingleInt, describeMmsSquared, true);
    top_solid_infill_acceleration: SettingsDescriptor<number> = new SettingsDescriptor('top_solid_infill_acceleration', parseSingleInt, describeMmsSquared, true);
    travel_acceleration: SettingsDescriptor<number> = new SettingsDescriptor('travel_acceleration', parseSingleInt, describeMmsSquared, true);
    default_acceleration: SettingsDescriptor<number> = new SettingsDescriptor('default_acceleration', parseSingleInt, describeMmsSquared, true);

    // speeds
    infill_speed: SettingsDescriptor<number> = new SettingsDescriptor('infill_speed', parseSingleFloat, describeMms, true);
    solid_infill_speed: SettingsDescriptor<number> = new SettingsDescriptor('solid_infill_speed', parseSingleFloat, describeMms, true);
    top_solid_infill_speed: SettingsDescriptor<number> = new SettingsDescriptor('top_solid_infill_speed', parseSingleFloat, describeMms, true);
    perimeter_speed: SettingsDescriptor<number> = new SettingsDescriptor('perimeter_speed', parseSingleInt, describeMms, true);
    travel_speed: SettingsDescriptor<number> = new SettingsDescriptor('travel_speed', parseSingleInt, describeMms, true);

    perimeter_extrusion_width: SettingsDescriptor<number> = new SettingsDescriptor('perimeter_extrusion_width', parseSingleFloat, describeMm, true);
    travel_speed_z: SettingsDescriptor<number> = new SettingsDescriptor('travel_speed_z', parseSingleInt, describeMms, true);

    // retractions
    retract_length: SettingsDescriptor<number> = new SettingsDescriptor('retract_length', parseToolFloat, describeMm, true);
    retract_restart_extra: SettingsDescriptor<number> = new SettingsDescriptor('retract_restart_extra', parseToolFloat, describeMm, true);
    retract_speed: SettingsDescriptor<number> = new SettingsDescriptor('retract_speed', parseToolFloat, describeMms, true);
    deretract_speed: SettingsDescriptor<number> = new SettingsDescriptor('deretract_speed', parseToolFloat, describeMms, true);
    retract_lift: SettingsDescriptor<number> = new SettingsDescriptor('retract_lift', parseToolFloat, describeMm, true);
    // filament retraction overrides
    filament_retract_length: SettingsDescriptor<number> = new SettingsDescriptor('filament_retract_length', parseToolFloat, describeMm, false);
    filament_retract_restart_extra: SettingsDescriptor<number> = new SettingsDescriptor('retract_restart_extra', parseToolFloat, describeMm, false);
    filament_retract_speed: SettingsDescriptor<number> = new SettingsDescriptor('filament_retract_speed', parseToolFloat, describeMms, false);
    filament_deretract_speed: SettingsDescriptor<number> = new SettingsDescriptor('filament_deretract_speed', parseToolFloat, describeMms, false);
    filament_retract_lift: SettingsDescriptor<number> = new SettingsDescriptor('filament_retract_lift', parseToolFloat, describeMm, false);
    
    layer_height: SettingsDescriptor<number> = new SettingsDescriptor('layer_height', parseSingleFloat, describeMm, true);
    disable_fan_first_layers: SettingsDescriptor<number> = new SettingsDescriptor('disable_fan_first_layers', parseToolFloat, describeNumber, true);
    first_layer_speed: SettingsDescriptor<number> = new SettingsDescriptor('first_layer_speed', parseSingleFloat, describeMms, true);
    min_fan_speed: SettingsDescriptor<number> = new SettingsDescriptor('min_fan_speed', parseToolFloat, describePercent, true);
    
    max_volumetric_speed: SettingsDescriptor<number> = new SettingsDescriptor('max_volumetric_speed', parseSingleFloat, describeMmCubed, true);
    filament_max_volumetric_speed: SettingsDescriptor<number> = new SettingsDescriptor('filament_max_volumetric_speed', parseSingleFloat, describeMmCubed, false);
}

export class RequiredSlicerSettings {
    hasAllSettings = true;
    hasErrors = false;
    errorCount = 0;
    errors: Array<string> = []
    #allErrors: Array<Array<string>> = [];
    allSettings: Array<SettingValue<any>> = []

    perimeter_extruder: SettingValue<number>;
    printer_model: SettingValue<string>;
    gcode_flavor: SettingValue<string>;
    filament_settings_id: SettingValue<string>;
    bed_shape: SettingValue<BedShape>;
    nozzle_diameter: SettingValue<number>;
    bed_temperature: SettingValue<number>;
    external_perimeter_extrusion_width: SettingValue<number>;
    extrusion_multiplier: SettingValue<number>;
    temperature: SettingValue<number>;
    first_layer_temperature: SettingValue<number>;
    filament_diameter: SettingValue<number>;
    filament_retract_length: SettingValue<number>;
    filament_retract_lift: SettingValue<number>;
    infill_acceleration: SettingValue<number>;
    perimeter_acceleration: SettingValue<number>;
    external_perimeter_acceleration: SettingValue<number>;
    first_layer_acceleration: SettingValue<number>;
    machine_max_acceleration_extruding: SettingValue<number>;
    solid_infill_acceleration: SettingValue<number>;
    top_solid_infill_acceleration: SettingValue<number>;
    travel_acceleration: SettingValue<number>;
    default_acceleration: SettingValue<number>;
    perimeter_extrusion_width: SettingValue<number>;
    perimeter_speed: SettingValue<number>;
    travel_speed: SettingValue<number>;
    travel_speed_z: SettingValue<number>;
    retract_length: SettingValue<number>;
    filament_retract_restart_extra: SettingValue<number>;
    filament_retract_speed: SettingValue<number>;
    filament_deretract_speed: SettingValue<number>;
    retract_lift: SettingValue<number>;
    retract_restart_extra: SettingValue<number>;
    retract_speed: SettingValue<number>;
    deretract_speed: SettingValue<number>;
    layer_height: SettingValue<number>;
    disable_fan_first_layers: SettingValue<number>;
    first_layer_speed: SettingValue<number>;
    min_fan_speed: SettingValue<number>;
    infill_speed: SettingValue<number>;
    solid_infill_speed: SettingValue<number>;
    top_solid_infill_speed: SettingValue<number>;
    max_volumetric_speed: SettingValue<number>;
    filament_max_volumetric_speed: SettingValue<number>;
    start_gcode: SettingValue<string>;

    #toValue<T>(foundSettings: Map<string, string>, descriptor: SettingsDescriptor<T>): SettingValue<T> {
        const toolNumber: number | null = this?.perimeter_extruder?.value;
        let val: SettingValue<T>;
        if (foundSettings.has(descriptor.key)) {
            val = new SettingValue<T>(descriptor.key, '' + foundSettings.get(descriptor.key));
            val.raw = '' + foundSettings.get(descriptor.key);
            // TODO: this is kind of hacky, maybe pull this out first and if it cant be found don't call this function
            descriptor.parser(val, toolNumber);
            descriptor.describer(val);
        } else {
            if (descriptor.isRequired) {
                this.hasAllSettings = false;
                val = new SettingValue<T>(descriptor.key, '');
                val.displayValue = '';
                val.errors.push('Required setting not found');
            } else {
                val = new SettingValue<T>(descriptor.key, '');
                val.displayValue = '';
            }
        }
        this.#allErrors.push(val.errors);
        this.allSettings.push(val); // makes it easy for the front end to iterate over all settings
        return val;
    }

    constructor(foundSettings: Map<string, string>) {
        let descriptors = new RequiredSettingsDescriptors();
        this.perimeter_extruder = this.#toValue(foundSettings, descriptors.perimeter_extruder);
        this.printer_model = this.#toValue(foundSettings, descriptors.printer_model);
        this.gcode_flavor = this.#toValue(foundSettings, descriptors.gcode_flavor);
        this.filament_settings_id = this.#toValue(foundSettings, descriptors.filament_settings_id);
        this.bed_shape = this.#toValue(foundSettings, descriptors.bed_shape);
        this.nozzle_diameter = this.#toValue(foundSettings, descriptors.nozzle_diameter);
        this.bed_temperature = this.#toValue(foundSettings, descriptors.bed_temperature);
        this.external_perimeter_extrusion_width = this.#toValue(foundSettings, descriptors.external_perimeter_extrusion_width);
        this.extrusion_multiplier = this.#toValue(foundSettings, descriptors.extrusion_multiplier);
        this.temperature = this.#toValue(foundSettings, descriptors.temperature);
        this.first_layer_temperature = this.#toValue(foundSettings, descriptors.first_layer_temperature);
        this.filament_diameter = this.#toValue(foundSettings, descriptors.filament_diameter);
        this.retract_lift = this.#toValue(foundSettings, descriptors.retract_lift);
        this.retract_length = this.#toValue(foundSettings, descriptors.retract_length);
        this.retract_restart_extra = this.#toValue(foundSettings, descriptors.retract_restart_extra);
        this.retract_speed = this.#toValue(foundSettings, descriptors.retract_speed);
        this.deretract_speed = this.#toValue(foundSettings, descriptors.deretract_speed);
        this.filament_retract_lift = this.#toValue(foundSettings, descriptors.filament_retract_lift);
        this.filament_retract_length = this.#toValue(foundSettings, descriptors.filament_retract_length);
        this.filament_retract_restart_extra = this.#toValue(foundSettings, descriptors.filament_retract_restart_extra);
        this.filament_retract_speed = this.#toValue(foundSettings, descriptors.filament_retract_speed);
        this.filament_deretract_speed = this.#toValue(foundSettings, descriptors.filament_deretract_speed);
        this.infill_acceleration = this.#toValue(foundSettings, descriptors.infill_acceleration);
        this.perimeter_acceleration = this.#toValue(foundSettings, descriptors.perimeter_acceleration);
        this.external_perimeter_acceleration = this.#toValue(foundSettings, descriptors.external_perimeter_acceleration);
        this.first_layer_acceleration = this.#toValue(foundSettings, descriptors.first_layer_acceleration);
        this.machine_max_acceleration_extruding = this.#toValue(foundSettings, descriptors.machine_max_acceleration_extruding);
        this.solid_infill_acceleration = this.#toValue(foundSettings, descriptors.solid_infill_acceleration);
        this.top_solid_infill_acceleration = this.#toValue(foundSettings, descriptors.top_solid_infill_acceleration);
        this.travel_acceleration = this.#toValue(foundSettings, descriptors.travel_acceleration);
        this.default_acceleration = this.#toValue(foundSettings, descriptors.default_acceleration);
        this.perimeter_extrusion_width = this.#toValue(foundSettings, descriptors.perimeter_extrusion_width);
        this.perimeter_speed = this.#toValue(foundSettings, descriptors.perimeter_speed);
        this.solid_infill_speed = this.#toValue(foundSettings, descriptors.solid_infill_speed);
        this.top_solid_infill_speed = this.#toValue(foundSettings, descriptors.top_solid_infill_speed);
        this.travel_speed = this.#toValue(foundSettings, descriptors.travel_speed);
        this.travel_speed_z = this.#toValue(foundSettings, descriptors.travel_speed_z);
        this.layer_height = this.#toValue(foundSettings, descriptors.layer_height);
        this.disable_fan_first_layers = this.#toValue(foundSettings, descriptors.disable_fan_first_layers);
        this.first_layer_speed = this.#toValue(foundSettings, descriptors.first_layer_speed);
        this.min_fan_speed = this.#toValue(foundSettings, descriptors.min_fan_speed);
        this.infill_speed = this.#toValue(foundSettings, descriptors.infill_speed);
        this.max_volumetric_speed = this.#toValue(foundSettings, descriptors.max_volumetric_speed);
        this.filament_max_volumetric_speed = this.#toValue(foundSettings, descriptors.filament_max_volumetric_speed);
        this.start_gcode = this.#toValue(foundSettings, descriptors.start_gcode);
        // concat all errors
        this.#allErrors.forEach(val => { this.errors.push(...val) });
        this.errorCount = this.errors.length;
        this.hasErrors = this.errorCount > 0;
    }
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
    fileName: string = '';
    fileExtension: string = '';
    rawSettings: Map<string, string> = new Map();
    requiredSettings: RequiredSlicerSettings | null = null;

    errors: Array<string> = [];

    constructor(file: File, onComplete: () => void) {
        this.fileName = file.name;
        this.fileExtension = this.#extractExtension();
        if (this.fileExtension === '.bgcode') {
            this.errors.push('Binary Gcode files are not supported. Please disable binary gcode in the slicer and export plain text gcode.');
        }
        const reader = new FileReader();
        let self = this;
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

    #extractExtension(): string {
        let dotIndex = this.fileName.lastIndexOf('.');
        // TODO: if file name ends with '.bgcode' complain about binary gcode
        return this.fileName.substring(dotIndex);
    }

    #processContents(gcode: string) {
        this.allLines = gcode.split(/\r?\n/);
        this.allLines = this.#stripTypeCustom();
        this.rawSettings = this.#extractPrusaSlicerSettings();
        this.requiredSettings = new RequiredSlicerSettings(this.rawSettings);
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
            if (line === ";AFTER_LAYER_CHANGE") {
                return this.allLines.slice(0, i);
            }
        }
        this.errors.push("Could not find the last line of the start gcode block. Missing <code>;AFTER_LAYER_CHANGE</code> comment. Check in the printers custom gcode settings.");
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