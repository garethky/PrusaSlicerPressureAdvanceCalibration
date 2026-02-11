import { describe, it, expect } from 'vitest';
import { valueFromSetting, SettingValue, parseSingleInt, parseSingleFloat, parseToolFloat, describeMm, SettingsDescriptor, RequiredSlicerSettings } from './GcodeProcessor';

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
        parseToolFloat(val, 1);
        expect(val.value).toBeNull();
    });
});

describe('valueFromSetting tests', () => {
    const toolNumber = 1;
    it('simple setting works', () => {
        let foundSettings = new Map<string, string>();
        foundSettings.set('test_setting', '42');
        let desc = new SettingsDescriptor('test_setting', parseSingleInt, describeMm, true);
        let allErrors: Array<Array<string>> = [];
        let allSettings: Array<SettingValue<any>> = [];
        let valOut = valueFromSetting(foundSettings, desc, toolNumber, allErrors, allSettings);
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
        let valOut = valueFromSetting(foundSettings, desc, toolNumber, allErrors, allSettings);
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
        let valOut = valueFromSetting(foundSettings, desc, toolNumber, allErrors, allSettings);
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
        let valOut = valueFromSetting(foundSettings, desc, toolNumber, allErrors, allSettings);
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
        let valOut = valueFromSetting(foundSettings, desc, toolNumber, allErrors, allSettings);
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
        let valOut = valueFromSetting(foundSettings, desc, toolNumber, allErrors, allSettings);
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
        let valOut = valueFromSetting(foundSettings, desc, toolNumber, allErrors, allSettings);
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
        const requiredSettings = new RequiredSlicerSettings(foundSettings, 1);
        expect(requiredSettings.nozzle_diameter.value).toBe(0.4);
        expect(requiredSettings.num_tools.value).toBe(1);
    });
    it('uses the selected tool nozzle diameter instead of defaulting to tool 1', () => {
        let foundSettings = new Map<string, string>();
        foundSettings.set('nozzle_diameter', '0.4,0.25');
        const requiredSettings = new RequiredSlicerSettings(foundSettings, 2);
        expect(requiredSettings.nozzle_diameter.value).toBe(0.25);
        expect(requiredSettings.num_tools.value).toBe(2);
    });
});
