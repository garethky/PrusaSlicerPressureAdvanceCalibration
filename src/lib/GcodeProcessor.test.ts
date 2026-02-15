import { describe, it, expect } from 'vitest';
import { valueFromSetting, SettingValue, parseSingleInt, parseSingleFloat, parseToolFloat, describeMm, SettingsDescriptor, RequiredSlicerSettings, GcodeProcessor } from './GcodeProcessor';

describe('nil values tests', () => {
    it('parseSingleFloat of nil is null', () => {
        let val: SettingValue<number> = new SettingValue('test_setting', 'nil');
        parseSingleFloat(val, -1);
        expect(val.value).toBeNull();
    });
    it('parseSingleInt of nil is null', () => {
        let val: SettingValue<number> = new SettingValue('test_setting', 'nil');
        parseSingleInt(val, -1);
        expect(val.value).toBeNull();
    });
    it('parseToolFloat of nil is null', () => {
        let val: SettingValue<number> = new SettingValue('test_setting', 'nil,10');
        parseToolFloat(val, 0);
        expect(val.value).toBeNull();
    });
});

describe('valueFromSetting tests', () => {
    const toolIndex = 0;
    it('simple setting works', () => {
        let foundSettings = new Map<string, string>();
        foundSettings.set('test_setting', '42');
        let desc = new SettingsDescriptor('test_setting', parseSingleInt, describeMm, true);
        let allErrors: Array<Array<string>> = [];
        let allSettings: Array<SettingValue<any>> = [];
        let valOut = valueFromSetting(foundSettings, desc, toolIndex, allErrors, allSettings);
        expect(valOut.value).toBe(42);
        expect(valOut.displayValue).toBe('42 mm');
        expect(allErrors[0].length).toBe(0);
        expect(allSettings.length).toBe(1);
    });
    it('test missing setting', () => {
        let foundSettings = new Map<string, string>();
        let desc = new SettingsDescriptor('test_setting', parseSingleInt, describeMm, true);
        let allErrors: Array<Array<string>> = [];
        let allSettings: Array<SettingValue<any>> = [];
        let valOut = valueFromSetting(foundSettings, desc, toolIndex, allErrors, allSettings);
        expect(valOut.value).toBeNull();
        expect(valOut.displayValue).toBe('');
        expect(allErrors[0].length).toBe(1);
        expect(allSettings.length).toBe(1);
    });
    it('test nil setting', () => {
        let foundSettings = new Map<string, string>();
        foundSettings.set('test_setting', 'nil');
        let desc = new SettingsDescriptor('test_setting', parseSingleInt, describeMm, true);
        let allErrors: Array<Array<string>> = [];
        let allSettings: Array<SettingValue<any>> = [];
        let valOut = valueFromSetting(foundSettings, desc, toolIndex, allErrors, allSettings);
        expect(valOut.value).toBeNull();
        expect(valOut.displayValue).toBe('');
        expect(allErrors[0].length).toBe(1);
        expect(allSettings.length).toBe(1);
    });
    it('test nil setting not required', () => {
        let foundSettings = new Map<string, string>();
        foundSettings.set('test_setting', 'nil');
        let desc = new SettingsDescriptor('test_setting', parseSingleInt, describeMm, false);
        let allErrors: Array<Array<string>> = [];
        let allSettings: Array<SettingValue<any>> = [];
        let valOut = valueFromSetting(foundSettings, desc, toolIndex, allErrors, allSettings);
        expect(valOut.value).toBeNull();
        expect(valOut.displayValue).toBe('');
        expect(allErrors[0].length).toBe(0);
        expect(allSettings.length).toBe(1);
    });
    it('test filament setting with value', () => {
        let foundSettings = new Map<string, string>();
        foundSettings.set('test_setting', '42.42,nil');
        let desc = new SettingsDescriptor('test_setting', parseToolFloat, describeMm, true);
        let allErrors: Array<Array<string>> = [];
        let allSettings: Array<SettingValue<any>> = [];
        let valOut = valueFromSetting(foundSettings, desc, toolIndex, allErrors, allSettings);
        expect(valOut.value).toBe(42.42);
        expect(valOut.displayValue).toBe('42.42 mm');
        expect(allErrors[0].length).toBe(0);
        expect(allSettings.length).toBe(1);
    });
    it('test nil filament setting', () => {
        let foundSettings = new Map<string, string>();
        foundSettings.set('test_setting', 'nil,42');
        let desc = new SettingsDescriptor('test_setting', parseToolFloat, describeMm, true);
        let allErrors: Array<Array<string>> = [];
        let allSettings: Array<SettingValue<any>> = [];
        let valOut = valueFromSetting(foundSettings, desc, toolIndex, allErrors, allSettings);
        expect(valOut.value).toBeNull();
        expect(allErrors[0].length).toBe(1);
        expect(allSettings.length).toBe(1);
    });
    it('test nil filament setting not required', () => {
        let foundSettings = new Map<string, string>();
        foundSettings.set('test_setting', 'nil,42');
        let desc = new SettingsDescriptor('test_setting', parseToolFloat, describeMm, false);
        let allErrors: Array<Array<string>> = [];
        let allSettings: Array<SettingValue<any>> = [];
        let valOut = valueFromSetting(foundSettings, desc, toolIndex, allErrors, allSettings);
        expect(valOut.displayValue).toBe('');
        expect(valOut.value).toBeNull();
        expect(allErrors[0].length).toBe(0);
        expect(allSettings.length).toBe(1);
    });
});

describe('multi-extruder nozzle selection', () => {
    it('uses the default nozzle diameter when only one tool is detected', () => {
        let foundSettings = new Map<string, string>();
        foundSettings.set('nozzle_diameter', '0.4');
        const requiredSettings = new RequiredSlicerSettings(foundSettings, 0);
        expect(requiredSettings.settings.nozzle_diameter.value).toBe(0.4);
        expect(requiredSettings.settings.num_tools.value).toBe(1);
    });
    it('uses the selected tool nozzle diameter instead of defaulting to tool 1', () => {
        let foundSettings = new Map<string, string>();
        foundSettings.set('nozzle_diameter', '0.4,0.25');
        const requiredSettings = new RequiredSlicerSettings(foundSettings, 1);
        expect(requiredSettings.settings.nozzle_diameter.value).toBe(0.25);
        expect(requiredSettings.settings.num_tools.value).toBe(2);
    });
});

describe('findEndGcode', () => {
    it('finds end gcode when "; Filament-specific end gcode" is followed by ";END gcode for filament"', () => {
        const gcode = [
            'G28 X Y',
            'M104 S0',
            '; Filament-specific end gcode',
            ';END gcode for filament',
        ].join('\n');
        const processor = new GcodeProcessor(gcode, 'test.gcode');
        expect(processor.endLines).toEqual([
            '; Filament-specific end gcode',
            ';END gcode for filament',
        ]);
    });

    it('finds end gcode when "; Filament-specific end gcode" is the last line', () => {
        const gcode = [
            'G28 X Y',
            'M104 S0',
            '; Filament-specific end gcode',
        ].join('\n');
        const processor = new GcodeProcessor(gcode, 'test.gcode');
        expect(processor.endLines).toEqual([
            '; Filament-specific end gcode',
        ]);
    });

    it('reports an error when "; Filament-specific end gcode" is missing', () => {
        const gcode = [
            'G28 X Y',
            'M104 S0',
            ';END gcode for filament',
        ].join('\n');
        const processor = new GcodeProcessor(gcode, 'test.gcode');
        expect(processor.endLines).toEqual([]);
        expect(processor.errors.length).toBeGreaterThan(0);
    });
});

describe.each([
    ["G1 X200", 0],
    ["T0", 0],
    ["T2", 2],
    ["T2\nT1\n", 1],
    ]
)
    ('tool change parsing', (test_gcode, tool_number) => {
    it(`parse tool change from gcode: "${test_gcode}" -> ${tool_number}`, () => {
        const processor = new GcodeProcessor(test_gcode as string, 'test.gcode');
        expect(processor.toolIndex).toBe(tool_number);
    });
});