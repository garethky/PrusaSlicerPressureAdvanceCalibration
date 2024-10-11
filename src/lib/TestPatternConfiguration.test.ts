import { describe, it, expect, test } from 'vitest';
import { selectPressureAdvanceGCodePrefix } from './TestPatternConfiguration';

describe('GCode Prefix Tests', () => {
    const klipperPrefix = 'SET_PRESSURE_ADVANCE EXTRUDER=extruder1 ADVANCE=';
    const reprapPrefix = 'M572 D1 S';
    const marlinPrefix = 'M900 K';
    const prusaPrefix = 'M572 S';
    test.each([
            // klipper
            ['klipper', 'Voron 2.4', klipperPrefix],
            // RRF
            ['reprapfirmware', 'E3D Tool Changer', reprapPrefix],
            // Marlin
            ['marlin', 'MK3', marlinPrefix],
            ['marlin', 'MK3S', marlinPrefix],
            ['marlin', 'MK2', marlinPrefix],
            // Legacy Marlin 2, before Pressure Advance
            ['marlin2', 'MINI', marlinPrefix],
            ['marlin2', 'XL', marlinPrefix],
            ['marlin2', 'XL2', marlinPrefix],
            ['marlin2', 'XL5', marlinPrefix],
            ['marlin2', 'MK4', marlinPrefix],
            // Prusa M572
            ['marlin2', 'MK3.5', prusaPrefix],
            ['marlin2', 'MK3.5S', prusaPrefix],
            ['marlin2', 'MK3.9', prusaPrefix],
            ['marlin2', 'MK3.9S', prusaPrefix],
            ['marlin2', 'MK4S', prusaPrefix],
            ['marlin2', 'MINIIS', prusaPrefix],
            ['marlin2', 'XLIS', prusaPrefix],
            ['marlin2', 'XL2IS', prusaPrefix],
            ['marlin2', 'XL5IS', prusaPrefix],
            // Future marlin2 printers
            ['marlin2', 'unknown', prusaPrefix],

        ])('selectPressureAdvanceGCodePrefix(%s, %s, 1) -> %s', (flavour, printerModel, expected) => {
            expect(selectPressureAdvanceGCodePrefix(flavour, printerModel, 1).gcodePrefix).toBe(expected);
        })
});