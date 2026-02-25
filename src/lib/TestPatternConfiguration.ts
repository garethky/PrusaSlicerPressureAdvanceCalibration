import { writable } from 'svelte/store';
import type { GcodeProcessor, RequiredSlicerSettings, SettingValue } from './GcodeProcessor';
import type { PressureAdvanceModel } from './PressureAdvanceModel';
import {type Explanation, ExplanationMaxOf, ExplanationVolumetricFlow, ExplanationSumOf, ExplanationFanSpeed, ExplanationPaGcode, ExplanationArray } from './TestPatternSettingExplainer';
import { validatePrintArea as validatePrintArea } from './TestPatternGenerator';
import { prepareStartEndGcode } from './StartEndGcodePrep';

export class PrintArea {
    x: number;
    y: number;
    width: number;
    height: number;
    errors: Array<string> = [];

    constructor(x: number, y: number, width: number, height: number) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    description() {
        return `Start Location: x: ${this.x}mm, y:${this.y}, Width: ${this.width}mm, Height: ${this.height}mm`;
    }
}

export type PressureAdvanceGCode = {
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
        gcodePrefix: `SET_PRESSURE_ADVANCE EXTRUDER=${extruder} ADVANCE=`,
        slicerTemplate: `SET_PRESSURE_ADVANCE EXTRUDER=extruder{if filament_extruder_id > 0}filament_extruder_id{endif} ADVANCE=`
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

// Resolve the effective volumetric flow rate from printer and filament settings.
// Returns the flow rate in mm³/s, or null if neither setting has a positive value.
function effectiveVolumetricFlowRate(slicerSettings: RequiredSlicerSettings): number | null {
    const settings = slicerSettings.settings;
    const maxFilamentVolumetricFlow = settings.filament_max_volumetric_speed.toValue();
    if (!!maxFilamentVolumetricFlow && maxFilamentVolumetricFlow > 0) {
        return maxFilamentVolumetricFlow;
    }
    const maxVolumetricFlow = settings.max_volumetric_speed.toValue();
    if (!!maxVolumetricFlow && maxVolumetricFlow > 0) {
        return maxVolumetricFlow;
    }
    return null;
}

// Convert a volumetric flow rate limit to a max linear speed given extrusion geometry.
function volumetricFlowToSpeed(flowRate: number, extrusionWidth: number, layerHeight: number): number {
    return flowRate / (extrusionWidth * layerHeight);
}

// Clamp a speed to the volumetric flow rate limit. Returns the clamped speed.
function clampSpeedToVolumetricFlow(requestedSpeed: number, maxLinearSpeed: number): number {
    return Math.min(requestedSpeed, maxLinearSpeed);
}

function selectAdvanceGCodePrefix(slicerSettings: RequiredSlicerSettings, toolIndex: number) {
    const settings = slicerSettings.settings;
    let flavour = settings.gcode_flavor.toValue();
    let printerModel = settings.printer_model.toValue();
    const gcode: PressureAdvanceGCode = selectPressureAdvanceGCodePrefix(flavour, printerModel, toolIndex);

    return new ExplainedValue("Pressure Advance Type", gcode, gcode.displayValue, new ExplanationPaGcode(settings.gcode_flavor, settings.printer_model));
}

export function selectPressureAdvanceGCodePrefix(flavour: string, printerModel: string, toolIndex: number): PressureAdvanceGCode {
    let gcode: PressureAdvanceGCode;
    if ('klipper'.localeCompare(flavour) === 0) {
        return klipperGcode(toolIndex);
    }
    
    if ('reprapfirmware'.localeCompare(flavour) === 0) {
        return reprapfirmwareGcode(toolIndex);
    }

    // legacy marlin linear advance
    if ('marlin'.localeCompare(flavour) === 0) {
        return marlinGcode();
    }
    
    if ('marlin2'.localeCompare(flavour) === 0) {
        // Prusa changed from linear advance (M900) to pressure advance (M572) when they launched Input Shaping
        // The most forward compatible solution is to assume M572 going forward for all marlin2 printers
        // Legacy models with firmware before 5.0, use M900
        if (!!printerModel.match(/^(XL|XL2|XL5|MK4|MINI)$/)) {
            // legacy marlin linear advance
            return marlinGcode();
        } else {
            // M572 pressure advance
            return prusaIsGcode();
        }
    }

    throw `Sorry, your firmware type "${flavour}" is not supported yet`;
}

// Precision rounding to the nth decimal place
export function roundTo(value: number, decimals:number = 2): number {
    //return Number(Math.round(value + 'e+' + decimals) + 'e-' + decimals);
    if (!isFinite(value)) return value; // Handle NaN, Infinity, and -Infinity

    const factor = Math.pow(10, decimals);
    const result = Math.round((value + Math.sign(value) * Number.EPSILON) * factor) / factor;
    return result === 0 ? 0 : result; // Ensure `-0` becomes `0`
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

function sumExplainedValue(name: string, units: string, values: Array<SettingValue<number>>): ExplainedValue<number> {
    let sum = 0;
    values.forEach(value => {
        sum += value.toValue();
    });

    sum = roundTo(sum, 3);

    return new ExplainedValue(name, sum, `${sum} ${units}`, new ExplanationSumOf(values));
}

function maxExplainedValue(name: string, values: Array<SettingValue<number>>, default_value?: SettingValue<number>): ExplainedValue<number> {
    let maxValue = 0;
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
    if (default_value && default_value.toValue() > 0){
        return simpleExplainedValue(name, default_value);
    }
    throw `${name}: No max value found, all values are null or 0!`;
}

function explainClampedSpeed(name: string, slicerSettings: RequiredSlicerSettings, speedSetting: SettingValue<number>, maxLinearSpeed: number): ExplainedValue<number> {
    const settings = slicerSettings.settings;
    const requestedSpeed = speedSetting.toValue();
    const clampedSpeed = roundTo(clampSpeedToVolumetricFlow(requestedSpeed, maxLinearSpeed), 3);
    return new ExplainedValue(name, clampedSpeed, `${clampedSpeed} mm/s`, new ExplanationVolumetricFlow(
        [speedSetting],
        [settings.max_volumetric_speed, settings.filament_max_volumetric_speed],
        `${maxLinearSpeed.toFixed()} mm/s`, `${clampedSpeed.toFixed()} mm/s`
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
    num_tools: ExplainedValue<number>;
    tool_number: ExplainedValue<number>;
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
    default_extruding_acceleration: ExplainedValue<number>;
    testAcceleration: ExplainedValue<number>;
    printAcceleration: ExplainedValue<number>;
    zHopHeight: ExplainedValue<number>;
    advance_step: number;
    advance_lines: ExplainedValue<Array<number>>;
    print_area: ExplainedValue<PrintArea>;
    print_dir: number = 0.0;
    length_slow: number = 25;
    length_fast: number = 100;
    z_offset: number = 0.0;
    null_center: boolean = false;
    startLines: string[];
    endLines: string[];
    toolIndex: number;
    warnings: Array<string> = [];
    errors: Array<string> = [];
    

    constructor(gcodeStore: GcodeProcessor, slicerSettings: RequiredSlicerSettings, paModel: PressureAdvanceModel) {
        const settings = slicerSettings.settings;
        this.printer = simpleExplainedValue( 'Printer', settings.printer_model);
        this.filament = simpleExplainedValue('Filament Preset', settings.filament_settings_id);

        let diameter = settings.filament_diameter;
        this.filament_diameter = simpleExplainedValue('Filament Diameter', diameter);

        // filament temperature
        this.filament_temperature = simpleExplainedValue('Filament Temperature', settings.temperature);

        this.num_tools = simpleExplainedValue('Number of Tools', settings.num_tools);
        this.toolIndex = gcodeStore.toolIndex;
        this.tool_number = new ExplainedValue('Selected Tool', this.toolIndex + 1, `${this.toolIndex + 1}`, 'Selected tool from GCode');

        // Nozzle Diameter
        this.nozzle_diameter = simpleExplainedValue('Nozzle Diameter', settings.nozzle_diameter);
        this.height_layer = simpleExplainedValue('Layer Height', settings.layer_height);
        this.extrusion_width = simpleExplainedValue('Extrusion Width', settings.perimeter_extrusion_width);
        this.extrusion_multiplier = simpleExplainedValue('Extrusion Multiplier', settings.extrusion_multiplier);

        // z hop
        this.zHopHeight = filamentOverrideExplainedValue('Z-Hop Height', settings.retract_lift, settings.filament_retract_lift);

        // speeds
        const travelAcceleration = settings.travel_acceleration;
        const defaultAcceleration = settings.default_acceleration;
        const machine_acceleration = settings.machine_max_acceleration_extruding;
        this.travelAcceleration = simpleExplainedValue('Travel Acceleration', travelAcceleration.toValue() > 0 ? travelAcceleration : defaultAcceleration);
        const default_extruding_acceleration = defaultAcceleration.toValue() > 0 ? defaultAcceleration : machine_acceleration;
        this.default_extruding_acceleration = simpleExplainedValue('Default Extruding Acceleration', default_extruding_acceleration);
        this.testAcceleration = maxExplainedValue('Test Acceleration', [settings.perimeter_acceleration, settings.infill_acceleration, settings.solid_infill_acceleration, settings.top_solid_infill_acceleration, settings.external_perimeter_acceleration], default_extruding_acceleration);
        const firstLayerAcceleration = settings.first_layer_acceleration;
        this.printAcceleration = simpleExplainedValue('Print Acceleration', firstLayerAcceleration.toValue() > 0 ? firstLayerAcceleration : defaultAcceleration);

        const firstLayerSpeed = settings.first_layer_speed;
        const flowRate = effectiveVolumetricFlowRate(slicerSettings);
        if (flowRate === null) {
            throw 'No Volumetric Flow Rate setting was found.';
        }
        const extrusionWidth = settings.perimeter_extrusion_width.toValue();
        const layerHeight = settings.layer_height.toValue();
        const maxLinearSpeed = volumetricFlowToSpeed(flowRate, extrusionWidth, layerHeight);

        this.speed_print = explainClampedSpeed('Printing Speed', slicerSettings, firstLayerSpeed, maxLinearSpeed);
        this.speed_slow = explainClampedSpeed('Test Slow Extrusion Speed', slicerSettings, firstLayerSpeed, maxLinearSpeed);
        this.speed_fast = explainClampedSpeed('Test Fast Extrusion Speed', slicerSettings, settings.infill_speed, maxLinearSpeed);

        // Warn if slow/print speeds were clamped by volumetric flow limit
        const rawFirstLayerSpeed = firstLayerSpeed.toValue();
        if (this.speed_slow.value < rawFirstLayerSpeed) {
            this.warnings.push(
                `First layer speed (${rawFirstLayerSpeed} mm/s) exceeds the volumetric flow rate limit (${maxLinearSpeed.toFixed(1)} mm/s). ` +
                `Printing Speed and Test Slow Speed have been clamped to ${this.speed_slow.value.toFixed(1)} mm/s.`
            );
        }

        // Validate that fast speed is strictly greater than slow speed
        if (this.speed_fast.value <= this.speed_slow.value) {
            this.errors.push(
                `Test Fast Speed (${this.speed_fast.value.toFixed(1)} mm/s) is not faster than Test Slow Speed (${this.speed_slow.value.toFixed(1)} mm/s). ` +
                `The filament's volumetric flow rate limit (${flowRate} mm³/s) restricts the maximum print speed to ${maxLinearSpeed.toFixed(1)} mm/s. ` +
                `The test pattern requires the fast speed to be greater than the slow speed to produce a valid calibration. ` +
                `Try reducing the first layer speed in your print profile or increasing the volumetric flow rate limit.`
            );
        }
        this.speed_move = simpleExplainedValue('Travel Speed', settings.travel_speed);
        // if there is no z travel speed, fall back to normal travel speed
        const travelSpeedZ = settings.travel_speed_z;
        const travelSpeed = settings.travel_speed;
        this.speed_move_z = simpleExplainedValue('Z Movement Speed', travelSpeedZ.toValue() > 0 ? travelSpeedZ : travelSpeed);

        // retractions
        this.retract_dist = filamentOverrideExplainedValue('Retract Length', settings.retract_length, settings.filament_retract_length);
        const deretractOverride = settings.filament_retract_restart_extra.value !== null ? settings.filament_retract_restart_extra : settings.retract_restart_extra;
        this.deretract_dist = sumExplainedValue('Deretraction Length', 'mm', [this.retract_dist.explanation as SettingValue<number>, deretractOverride]);
        this.retract_speed = filamentOverrideExplainedValue('Retraction Speed', settings.retract_speed, settings.filament_retract_speed);
        this.deretract_speed = filamentOverrideExplainedValue('Deretraction Speed', settings.deretract_speed, settings.filament_deretract_speed);
        // TODO: bring back firmware retractions... maybe

        // bed shape
        let bedShape = settings.bed_shape.toValue();
        this.bed_shape = new ExplainedValue("Bed Shape", bedShape.shape, bedShape.shape, settings.bed_shape);
        this.bed_x = new ExplainedValue("Bed X Axis Size", bedShape.x, `${bedShape.x} mm`, settings.bed_shape);
        this.bed_y = new ExplainedValue("Bed Y Axis Size", bedShape.y, `${bedShape.y} mm`, settings.bed_shape);

        // turn fan off if disable_fan_first_layers is higher than 0
        const fanOffLayer = settings.disable_fan_first_layers.toValue();
        const minFanSpeed = settings.min_fan_speed.toValue();
        const fanSpeed = fanOffLayer > 0 ? 0 : minFanSpeed;
        this.fan_speed = new ExplainedValue("Part Cooling Fan Speed", fanSpeed, `${fanSpeed}%`, new ExplanationFanSpeed(fanSpeed, settings.min_fan_speed, settings.disable_fan_first_layers));

        this.advance_gcode_prefix = selectAdvanceGCodePrefix(slicerSettings, this.toolIndex);
        this.advance_step = paModel.step;
        let paModelString = `${paModel.lines.length} lines: ${paModel.lines[0]} ... ${paModel.lines[paModel.lines.length - 1]} in ${paModel.step} steps`;
        this.advance_lines = new ExplainedValue('Pressure Advance Test Values', paModel.lines, paModelString, new ExplanationArray(paModel.lines));

        let printArea = validatePrintArea(this);
        this.print_area = new ExplainedValue("Print Area", printArea, printArea.description(), 'Calculated Print Area');

        this.startLines = gcodeStore.startLines.slice(0);
        this.endLines = gcodeStore.endLines.slice(0);
        prepareStartEndGcode(slicerSettings, this);
    }
}

export const testPatternConfigStore = writable<TestPatternConfiguration | null>(null);
