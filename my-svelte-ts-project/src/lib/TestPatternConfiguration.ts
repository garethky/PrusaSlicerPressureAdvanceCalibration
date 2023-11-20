import { writable } from 'svelte/store';
import type { RequiredSlicerSettings, SettingValue } from './GcodeProcessor';
import type { PressureAdvanceModel } from './PressureAdvanceModel';
import {type Explanation, ExplanationMaxOf, ExplanationVolumetricFlow, ExplanationSumOf, ExplanationFanSpeed, ExplanationPaGcode, ExplanationArray } from './TestPatternSettingExplainer';

type PressureAdvanceGCode = {
    // this is the stirng that contains just the co with no arguments for display
    displayValue: string
    // this value is used in rendering gcode for the test
    gcodePrefix: string;
    // this value is used in rendering filament conditional gcode
    slicerTemplate: string;
}

function klipperGcode(toolIndex: number): PressureAdvanceGCode {
    let extruder = 'extruder';
    if (toolIndex > 0) {
        extruder += toolIndex;
    }
    return {
        displayValue: `klipper: PRESSURE_ADVANCE`,
        gcodePrefix: `PRESSURE_ADVANCE EXTRUDER=${extruder} ADVANCE=`,
        slicerTemplate: `PRESSURE_ADVANCE EXTRUDER=extruder{if filament_extruder_id > 0}filament_extruder_id{endif} ADVANCE=`
    };
}

function reprapfirmwareGcode(toolIndex: number): PressureAdvanceGCode {
    return {
        displayValue: `RepRapFirmware: M572`,
        gcodePrefix: `M572 D${toolIndex} S`,
        slicerTemplate: 'M572 D{filament_extruder_id} S'
    };
    
}

function prusaIsGcode(): PressureAdvanceGCode {
    // Prusa doesn't seem to have the D parameter from RRF
    return {
        displayValue: `Prusa Input Shaper: M572`,
        gcodePrefix: `M572 S`,
        slicerTemplate: 'M572 S'
    };
}

function marlinGcode(): PressureAdvanceGCode {
    return {
        displayValue: `Marlin Linear Advance: M900`,
        gcodePrefix: `M900 K`,
        slicerTemplate: 'M900 K'
    };
}

// sometimes the max speed requested in a profile exceeds the max volumetric speed of the filament or printer
// pick the min of volumetric flow rate limit and requested speed
function maxVolumetricSpeed(requestedSpeed: number, extrusionWidth: number, layerHeight: number, maxVolumetricFlow: number) {
    const maxSpeed = maxVolumetricFlow / (extrusionWidth * layerHeight);
    return Math.min(maxSpeed, requestedSpeed);
}

function selectAdvanceGCodePrefix(slicerSettings: RequiredSlicerSettings, toolIndex: number) {
    let flavour = slicerSettings.gcode_flavor.toValue();
    let printerModel = slicerSettings.printer_model.toValue();
    let gcode;
    if ('klipper'.localeCompare(flavour) === 0) {
        gcode = klipperGcode(toolIndex);
    } else if ('reprapfirmware'.localeCompare(flavour) === 0) {
        gcode = reprapfirmwareGcode(toolIndex);
    } else if (!!flavour.match('marlin|marlin2')) {
        // Modern Prusa Pressure Advance
        if (!!printerModel.match(/XL\d?IS|MK4IS|MINIIS/)) {
            gcode = prusaIsGcode();
        } else {
            // legacy marlin linear advance
            gcode = marlinGcode();
        }
    } else {
        throw `Sorry, your firmware type is not supported yet`;
    }

    return new ExplainedValue("Pressure Advance Type", gcode, gcode.displayValue, new ExplanationPaGcode(slicerSettings.gcode_flavor, slicerSettings.printer_model));
}

export class ExplainedValue<T> {
    value: T;
    displayName: string;
    displayValue: string;
    explanation: Explanation;

    constructor(displayName: string, value: T, displayValue: string | null, explanation: Explanation) {
        this.value = value;
        this.displayName = displayName;
        this.displayValue = displayValue as string;
        this.explanation = explanation;
    }
}

function simpleExplainedValue(name: string, value: SettingValue<any>): ExplainedValue<any> {
    return new ExplainedValue(name, value.toValue(), value.displayValue, value);
}

function sumExplainedValue(name: string, units: string, values: Array<SettingValue<any>>): ExplainedValue<number> {
    let sum = 0;
    values.forEach(value => {
        sum += value.toValue();
    });

    return new ExplainedValue(name, sum, `${sum} ${units}`, new ExplanationSumOf(values));
}

function maxExplainedValue(name: string, values: Array<SettingValue<number>>): ExplainedValue<number> {
    let maxValue = Number.MIN_VALUE;
    let maxValueSetting: SettingValue<number> | null = null;
    for (const value of values) {
        if (value.value !== null) {
            if (value.toValue() > maxValue) {
                maxValue = value.toValue();
                maxValueSetting = value;
            }
        }
    }
    if (maxValueSetting !== null) {
        return new ExplainedValue(name, maxValueSetting.toValue(), maxValueSetting.displayValue, new ExplanationMaxOf(values, maxValueSetting));
    }
    throw "No max Value found, all values are null!";
}

function explainMaxSpeed(slicerSettings: RequiredSlicerSettings) {
    const maxVolumetricFlow = slicerSettings.max_volumetric_speed.toValue();
    const maxFilamentVolumetricFlow = slicerSettings.filament_max_volumetric_speed.toValue();
    let flowRate: number;
    if (!!maxFilamentVolumetricFlow && maxFilamentVolumetricFlow > 0) {
        flowRate = maxFilamentVolumetricFlow;
    } else if (!!maxVolumetricFlow && maxVolumetricFlow > 0) {
        flowRate = maxVolumetricFlow;
    } else {
        throw 'No Volumetric Flow Rate setting was found.';
    }
    const extrusionWidth = slicerSettings.perimeter_extrusion_width.toValue();
    const layerHeight = slicerSettings.layer_height.toValue();
    const speedInfill = slicerSettings.infill_speed.toValue();
    const maxSpeed = flowRate / (extrusionWidth * layerHeight);
    const speedFast = Math.min(maxSpeed, speedInfill);
    return new ExplainedValue('Test Fast Extrusion Speed', speedFast, `${speedFast} mm/s`, new ExplanationVolumetricFlow(
        [slicerSettings.infill_speed],
        [slicerSettings.max_volumetric_speed, slicerSettings.filament_max_volumetric_speed],
        `${maxSpeed.toFixed()} mm/s`, `${speedFast.toFixed()} mm/s`
    ));
}

function filamentOverrideExplainedValue(name: string, defaultSetting: SettingValue<any>, filamentOverride: SettingValue<any>) {
    const picked = filamentOverride.value !== null ? filamentOverride : defaultSetting;
    return new ExplainedValue(name, picked.toValue(), picked.displayValue, picked);
}

// class responsible for integrating the data from the user gcode and the on-page form components
export class TestPatternConfiguration {
    printer: ExplainedValue<string>;
    filament: ExplainedValue<string>;
    filament_diameter: ExplainedValue<number>;
    filament_temperature: ExplainedValue<number>;
    nozzle_diameter: ExplainedValue<number>;
    height_layer: ExplainedValue<number>;
    extrusion_width: ExplainedValue<number>;
    extrusion_multiplier: ExplainedValue<number>;
    speed_slow: ExplainedValue<number>;
    speed_fast: ExplainedValue<number>;
    speed_print: ExplainedValue<number>;
    speed_move: ExplainedValue<number>;
    speed_move_z: ExplainedValue<number>;
    retract_dist: ExplainedValue<number>;
    retract_speed: ExplainedValue<number>;
    deretract_dist: ExplainedValue<number>;
    deretract_speed: ExplainedValue<number>;
    bed_shape: ExplainedValue<string>;
    bed_x: ExplainedValue<number>;
    bed_y: ExplainedValue<number>;
    fan_speed: ExplainedValue<number>;
    advance_gcode_prefix: ExplainedValue<PressureAdvanceGCode>;
    travelAcceleration: ExplainedValue<number>;
    testAcceleration: ExplainedValue<number>;
    printAcceleration: ExplainedValue<number>;
    zHopHeight: ExplainedValue<number>;
    advance_step: number;
    advance_lines: ExplainedValue<Array<number>>;
    print_dir: number = 0.0;
    length_slow: number = 25;
    length_fast: number = 100;
    z_offset: number = 0.0;
    null_center: boolean = false;
    

    constructor(slicerSettings: RequiredSlicerSettings, paModel: PressureAdvanceModel) {
        this.printer = simpleExplainedValue( 'Printer', slicerSettings.printer_model);
        this.filament = simpleExplainedValue('Filament Preset', slicerSettings.filament_settings_id);

        let diameter = slicerSettings.filament_diameter;
        this.filament_diameter = simpleExplainedValue('Filament Diameter', diameter);

        // filament temperature
        this.filament_temperature = maxExplainedValue('Filament Temperature', [slicerSettings.temperature, slicerSettings.first_layer_temperature]);
        
        // Nozzle Diameter
        this.nozzle_diameter = simpleExplainedValue('Nozzle Diameter', slicerSettings.nozzle_diameter);
        this.height_layer = simpleExplainedValue('Layer Height', slicerSettings.layer_height);
        this.extrusion_width = simpleExplainedValue('Extrusion Width', slicerSettings.perimeter_extrusion_width);
        this.extrusion_multiplier = simpleExplainedValue('Extrusion Multiplier', slicerSettings.extrusion_multiplier);
        
        // z hop
        this.zHopHeight = simpleExplainedValue('Z-Hop Height', slicerSettings.retract_lift);

        // speeds
        this.travelAcceleration = simpleExplainedValue('Travel Acceleration', slicerSettings.travel_acceleration);
        this.testAcceleration = maxExplainedValue('Test Acceleration', [slicerSettings.perimeter_acceleration, slicerSettings.infill_acceleration, slicerSettings.solid_infill_acceleration, slicerSettings.top_solid_infill_acceleration, slicerSettings.external_perimeter_acceleration]);
        this.printAcceleration = simpleExplainedValue('Print Acceleration', slicerSettings.first_layer_acceleration);
        
        this.speed_print = simpleExplainedValue('Printing Speed', slicerSettings.first_layer_speed);
        this.speed_slow = simpleExplainedValue('Test Slow Extrusion Speed', slicerSettings.first_layer_speed);
        this.speed_fast = explainMaxSpeed(slicerSettings);
        this.speed_move = simpleExplainedValue('Travel Speed', slicerSettings.travel_speed);
        this.speed_move_z = simpleExplainedValue('Z Movement Speed', slicerSettings.travel_speed_z);

        // retractions
        this.retract_dist = filamentOverrideExplainedValue('Retract Length', slicerSettings.retract_length, slicerSettings.filament_retract_length);
        let deretractOverride = slicerSettings.filament_retract_restart_extra.value !== null ? slicerSettings.filament_retract_restart_extra : slicerSettings.retract_restart_extra
        this.deretract_dist = sumExplainedValue('Deretraction Length', 'mm', [this.retract_dist.explanation as SettingValue<number>, deretractOverride]);
        this.retract_speed = filamentOverrideExplainedValue('Retraction Speed', slicerSettings.retract_speed, slicerSettings.filament_retract_speed);
        this.deretract_speed = filamentOverrideExplainedValue('Deretraction Speed', slicerSettings.deretract_speed, slicerSettings.filament_deretract_speed);
        // TODO: bring back firmware retractions... maybe

        // bed shape
        let bedShape = slicerSettings.bed_shape.toValue();
        this.bed_shape = new ExplainedValue("Bed Shape", bedShape.shape, bedShape.shape, slicerSettings.bed_shape);
        this.bed_x = new ExplainedValue("Bed X Axis Size", bedShape.x, `${bedShape.x} mm`, slicerSettings.bed_shape);
        this.bed_y = new ExplainedValue("Bed Y Axis Size", bedShape.y, `${bedShape.y} mm`, slicerSettings.bed_shape);
        
        // turn fan off if disable_fan_first_layers is higher than 0
        const fanOffLayer = slicerSettings.disable_fan_first_layers.toValue();
        const minFanSpeed = slicerSettings.min_fan_speed.toValue();
        const fanSpeed = fanOffLayer > 0 ? 0 : minFanSpeed;
        this.fan_speed = new ExplainedValue("Part Cooling Fan Speed", fanSpeed, `${fanSpeed}%`, new ExplanationFanSpeed(fanSpeed, slicerSettings.min_fan_speed, slicerSettings.disable_fan_first_layers));

        const toolIndex = slicerSettings.perimeter_extruder.toValue() - 1;
        this.advance_gcode_prefix = selectAdvanceGCodePrefix(slicerSettings, toolIndex);
        this.advance_step = paModel.step;
        let paModelString = `${paModel.lines.length} lines: ${paModel.lines[0]} ... ${paModel.lines[paModel.lines.length - 1]} in ${paModel.step} steps`;
        this.advance_lines = new ExplainedValue('Pressure Advance Test Values', paModel.lines, paModelString, new ExplanationArray(paModel.lines));
    }
}

export const testPatternConfigStore = writable<TestPatternConfiguration | null>(null);