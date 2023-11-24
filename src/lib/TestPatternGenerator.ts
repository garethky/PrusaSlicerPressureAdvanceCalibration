import type { GCodeProcessor } from './GcodeProcessor';
import {TestPatternConfiguration} from './TestPatternConfiguration';
import Big from 'big.js';

/**
 * K-Factor Calibration Pattern
 * Copyright (C) 2019 Sineos [https://github.com/Sineos]
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
type BasicSettings = {
    slowSpeed: number,
    fastSpeed: number,
    printSpeed: number,
    travelSpeed: number,
    travelSpeedZ: number,
    printAcceleration: number,
    travelAcceleration: number,
    testAcceleration: number,
    zHopHeight: number,
    centerX: number,
    centerY: number,
    printDir: number,
    lineWidth: number,
    extRatio: number,
    extMult: number,
    retractDist: number,
    unretractDist: number,
    retractSpeed : number,
    unretractSpeed: number,
};

type PatternSettings = {
    advanceGCodePrefix: string,
    lengthSlow: number,
    lengthFast: number,
    advanceLines: Array<number>,
    lineSpacing: number
};

// Settings version of localStorage
// Increase if default settings are changed / amended
const SETTINGS_VERSION = '1.1';

const LINE_SPACING =  4.0;

function validateAdvanceParameters(calibrationParams: TestPatternConfiguration) {
    const sizeY = calibrationParams.advance_lines.value.length * LINE_SPACING + 25, // +25 with ref marking
        sizeX = (2 * calibrationParams.length_slow) + calibrationParams.length_fast + 8,
        printDirRad = calibrationParams.print_dir * Math.PI / 180,
        fitWidth = roundDecimal(Math.abs(sizeX * Math.cos(printDirRad)) + Math.abs(sizeY * Math.sin(printDirRad)), 0),
        fitHeight = roundDecimal(Math.abs(sizeX * Math.sin(printDirRad)) + Math.abs(sizeY * Math.cos(printDirRad)), 0);

    // print is too big for a round bed
    if (calibrationParams.bed_shape.value === 'Round') {
        if ((Math.sqrt(Math.pow(fitWidth, 2) + Math.pow(fitHeight, 2)) > calibrationParams.bed_x.value)) {
            throw `TestPattern size (x: ${fitWidth}mm, y: ${fitHeight}mm) exceeds your bed's diameter (${calibrationParams.bed_x}mm).`;
        }
    }
    // print is too big for a square bed
    else if (fitWidth > calibrationParams.bed_x.value || fitHeight > calibrationParams.bed_y.value) {
        throw `'Test pattern size (x: ${fitWidth}mm, y: ${fitHeight}mm) exceeds your bed's usable size (x: (${calibrationParams.bed_x}mm y: (${calibrationParams.bed_y}mm).'`;
    }
}

export function generateTestPattern(calibrationParams: TestPatternConfiguration): string {
    // get the values from the HTML elements
    var PRINTER: string = calibrationParams.printer.value,
        FILAMENT: string = calibrationParams.filament.value,
        TRAVEL_ACCELERATION: number = calibrationParams.travelAcceleration.value,
        TEST_ACCELERATION: number = calibrationParams.testAcceleration.value,
        PRINT_ACCELERATION: number = calibrationParams.printAcceleration.value,
        FILAMENT_TEMPERATURE: number = calibrationParams.filament_temperature.value,
        FILAMENT_DIAMETER: number = calibrationParams.filament_diameter.value,
        NOZZLE_DIAMETER: number = calibrationParams.nozzle_diameter.value,
        LINE_WIDTH: number = calibrationParams.extrusion_width.value,
        SPEED_SLOW: number = calibrationParams.speed_slow.value,
        SPEED_FAST: number = calibrationParams.speed_fast.value,
        SPEED_PRINT: number = calibrationParams.speed_print.value,
        TRAVEL_SPEED: number = calibrationParams.speed_move.value,
        TRAVEL_SPEED_Z: number = calibrationParams.speed_move_z.value,
        Z_HOP_HEIGHT: number = calibrationParams.zHopHeight.value,
        RETRACT_SPEED: number = calibrationParams.retract_speed.value,
        UNRETRACT_SPEED: number = calibrationParams.deretract_speed.value,
        RETRACT_DIST: number = calibrationParams.retract_dist.value,
        UNRETRACT_DIST: number = calibrationParams.deretract_dist.value,
        BED_SHAPE: string = calibrationParams.bed_shape.value,
        BED_X: number = calibrationParams.bed_x.value,
        BED_Y: number = calibrationParams.bed_y.value,
        NULL_CENTER: boolean = calibrationParams.null_center,
        HEIGHT_LAYER: number = calibrationParams.height_layer.value,
        FAN_SPEED: number = calibrationParams.fan_speed.value,
        EXT_MULT: number = calibrationParams.extrusion_multiplier.value,
        ADVANCE_LINES: Array<number> = calibrationParams.advance_lines.value,
        PRINT_DIR: number = calibrationParams.print_dir,
        LENGTH_SLOW: number = calibrationParams.length_slow,
        LENGTH_FAST: number = calibrationParams.length_fast,
        ADVANCE_GCODE_PREFIX: string = calibrationParams.advance_gcode_prefix.value.gcodePrefix;


    if (BED_SHAPE === 'Round') {
        BED_Y = BED_X;
    }

    // Prusa slicer always stores values in mm/s so this conversion must always be done
    // convert mm/s to mm/minute
    SPEED_SLOW *= 60;
    SPEED_FAST *= 60;
    SPEED_PRINT *= 60;
    TRAVEL_SPEED *= 60;
    TRAVEL_SPEED_Z *= 60;
    RETRACT_SPEED *= 60;
    UNRETRACT_SPEED *= 60;

    var PRINT_SIZE_Y = (ADVANCE_LINES.length * LINE_SPACING) + 25, // +25 with ref marking
        PRINT_SIZE_X = (2 * LENGTH_SLOW) + LENGTH_FAST  + 8,
        CENTER_X = (NULL_CENTER ? 0 : BED_X / 2),
        CENTER_Y = (NULL_CENTER ? 0 : BED_Y / 2),
        PAT_START_X = CENTER_X - (0.5 * LENGTH_FAST) - LENGTH_SLOW - 4,
        PAT_START_Y = CENTER_Y - (PRINT_SIZE_Y / 2),
        //LINE_WIDTH = NOZZLE_DIAMETER * NOZZLE_LINE_RATIO,
        EXTRUSION_RATIO = LINE_WIDTH * HEIGHT_LAYER / (Math.pow(FILAMENT_DIAMETER / 2, 2) * Math.PI),
        printDirRad = PRINT_DIR * Math.PI / 180,
        FIT_WIDTH = Math.abs(PRINT_SIZE_X * Math.cos(printDirRad)) + Math.abs(PRINT_SIZE_Y * Math.sin(printDirRad)),
        FIT_HEIGHT = Math.abs(PRINT_SIZE_X * Math.sin(printDirRad)) + Math.abs(PRINT_SIZE_Y * Math.cos(printDirRad));

    var basicSettings: BasicSettings = {
        slowSpeed: SPEED_SLOW,
        fastSpeed: SPEED_FAST,
        printSpeed: SPEED_PRINT,
        travelSpeedZ: TRAVEL_SPEED_Z,
        travelSpeed: TRAVEL_SPEED,
        travelAcceleration: TRAVEL_ACCELERATION,
        printAcceleration: PRINT_ACCELERATION,
        testAcceleration: TEST_ACCELERATION,
        zHopHeight: Z_HOP_HEIGHT,
        centerX: CENTER_X,
        centerY: CENTER_Y,
        printDir: PRINT_DIR,
        lineWidth: LINE_WIDTH,
        extRatio: EXTRUSION_RATIO,
        extMult: EXT_MULT,
        retractDist: RETRACT_DIST,
        unretractDist: UNRETRACT_DIST,
        retractSpeed : RETRACT_SPEED,
        unretractSpeed : UNRETRACT_SPEED,
    };

    var patSettings = {
        advanceGCodePrefix: ADVANCE_GCODE_PREFIX,
        lengthSlow : LENGTH_SLOW,
        lengthFast: LENGTH_FAST,
        advanceLines: ADVANCE_LINES,
        lineSpacing: LINE_SPACING
    };

    // Start G-code for pattern
    var k_script =  `\n; ### Prusa Slicer K-Factor Calibration Pattern ###\n` +
                    `; -------------------------------------------------\n` +
                    `;\n` +
                    `; Printer: ${PRINTER}\n` +
                    `; Filament: ${FILAMENT}\n` +
                    `; Created: ${new Date()}\n` +
                    `;\n` +
                    `; Settings Printer:\n` +
                    `; Filament Diameter = ${FILAMENT_DIAMETER} mm\n` +
                    `; Nozzle Diameter = ${NOZZLE_DIAMETER} mm\n` +
                    `; Filament Temperature = S${FILAMENT_TEMPERATURE} C` +
                    `; Retraction Distance = ${RETRACT_DIST} mm\n` +
                    `; Layer Height = ${HEIGHT_LAYER} mm\n` +
                    //`; Extruder = ${TOOL_INDEX} \n` +
                    `; Fan Speed = ${FAN_SPEED} %\n` +
                    `;\n` +
                    `; Settings Print Bed:\n` +
                    `; Bed Shape = ${BED_SHAPE}\n` +
                    (BED_SHAPE === 'Round' ? `; Bed Diameter = ${BED_X} mm\n` : `; Bed Size X = ${BED_X} mm\n`) +
                    (BED_SHAPE === 'Round' ? `` : `; Bed Size Y = ${BED_Y} mm\n`) +
                    `; Origin Bed Center = ${(NULL_CENTER ? 'true' : 'false')}\n` +
                    `;\n` +
                    `; Settings Speed:\n` +
                    `; Slow Printing Speed = ${SPEED_SLOW} mm/min\n` +
                    `; Fast Printing Speed = ${SPEED_FAST} mm/min\n` +
                    `; Travel Speed = ${TRAVEL_SPEED} mm/min\n` +
                    `; Retract Speed = ${RETRACT_SPEED} mm/min\n` +
                    `; Unretract Speed = ${UNRETRACT_SPEED} mm/min\n` +
                    //`; Printing Acceleration = ${ACCELERATION} mm/s^2\n` +
                    `;\n` +
                    `; Settings Pattern:\n` +
                    `; Test Line Spacing = ${LINE_SPACING} mm\n` +
                    `; Test Line Length Slow = ${LENGTH_SLOW} mm\n` +
                    `; Test Line Length Fast = ${LENGTH_FAST} mm\n` +
                    `; Print Size X = ${FIT_WIDTH} mm\n` +
                    `; Print Size Y = ${FIT_HEIGHT} mm\n` +
                    `; Print Rotation = ${PRINT_DIR} degree\n` +
                    `;\n` +
                    `; -------------------------------------------------\n\n` +
                    `G92 E0 ; Reset extruder distance\n` +
                    `M106 S${Math.round(FAN_SPEED * 2.55)} ; Start print fan\n`;

    //move to layer Height
    k_script += 'G1 Z' + (HEIGHT_LAYER) + ' F' + SPEED_SLOW + ' ; Move to layer height\n';

    // Always print the frame, it helps with print removal and acts as a free prime
    var frameStartX1 = PAT_START_X,
        frameStartX2 = PAT_START_X + (2 * LENGTH_SLOW) + LENGTH_FAST,
        frameStartY = PAT_START_Y - 3,
        frameLength = PRINT_SIZE_Y - 19;

    k_script += ';\n' +
                '; print anchor frame\n' +
                ';\n' +
                moveTo(frameStartX1, frameStartY, basicSettings) +
                createLine(frameStartX1, frameStartY + frameLength, frameLength, basicSettings, {'extMult': EXT_MULT * 1.1}) +
                moveTo(frameStartX1 + LINE_WIDTH, frameStartY + frameLength, basicSettings) +
                createLine(frameStartX1 + LINE_WIDTH, frameStartY, -frameLength, basicSettings, {'extMult': EXT_MULT * 1.1}) +
                doEfeed('-', basicSettings) +
                moveTo(frameStartX2, frameStartY, basicSettings) +
                doEfeed('+', basicSettings) +
                createLine(frameStartX2, frameStartY + frameLength, frameLength, basicSettings, {'extMult': EXT_MULT * 1.1}) +
                moveTo(frameStartX2 - LINE_WIDTH, frameStartY + frameLength, basicSettings) +
                createLine(frameStartX2 - LINE_WIDTH, frameStartY, -frameLength, basicSettings, {'extMult': EXT_MULT * 1.1}) +
                doEfeed('-', basicSettings);

    // generate the k-factor Test pattern
    k_script += ';\n' +
                '; start the Test pattern\n' +
                ';\n' +
                moveTo(PAT_START_X, PAT_START_Y, basicSettings);

    k_script += createStdPattern(PAT_START_X, PAT_START_Y, basicSettings, patSettings);

    // Set pressure advance to the minimum test value for the rest of the print
    k_script += ';\n' +
                'M117 Pressure Advance = \n' +
                `${ADVANCE_GCODE_PREFIX}${ADVANCE_LINES[0]}; Set Pressure Advance to minimum test value\n`;

    // mark area of speed changes
    var refStartX1 = CENTER_X - (0.5 * LENGTH_FAST) - 4,
        refStartX2 = CENTER_X + (0.5 * LENGTH_FAST) - 4,
        refStartY = CENTER_Y + (PRINT_SIZE_Y / 2) - 20;

    k_script += ';\n' +
                '; Mark the test area for reference\n' +
                moveTo(refStartX1, refStartY, basicSettings) +
                doEfeed('+', basicSettings) +
                createLine(refStartX1, refStartY + 20, 20, basicSettings) +
                doEfeed('-', basicSettings) +
                moveTo(refStartX2, refStartY, basicSettings) +
                doEfeed('+', basicSettings) +
                createLine(refStartX2, refStartY + 20, 20, basicSettings) +
                doEfeed('-', basicSettings) +
                zHop(basicSettings);

    // print K values beside the test lines
    var numStartX = CENTER_X + (0.5 * LENGTH_FAST) + LENGTH_SLOW  - 2,
        numStartY = PAT_START_Y - 2,
        stepping = 0;

    k_script += ';\n' +
                '; print K-value next to lines\n' +
                ';\n';

    for (var stepping = 0; stepping < ADVANCE_LINES.length; stepping++) {
        var paValue = ADVANCE_LINES[stepping];
        // only print glyphs on every other line
        if (stepping % 2 === 0) {
            console.log('print ', paValue);
            k_script += moveTo(numStartX, numStartY + (stepping * LINE_SPACING), basicSettings) +
                        zHop(basicSettings) +
                        doEfeed('+', basicSettings) +
                        createGlyphs(numStartX, numStartY + (stepping * LINE_SPACING), basicSettings, roundDecimal(paValue, 3)) +
                        doEfeed('-', basicSettings) +
                        zHop(basicSettings);
        }
    }

  return k_script;
}

// TODO: emit M73 to drive completion UI in printers
// https://help.prusa3d.com/article/prusa-firmware-specific-g-codes_112173 - supports P and R
// https://marlinfw.org/docs/gcode/M073.html - supports P and R
// https://docs.duet3d.com/User_manual/Reference/Gcodes#m73-set-remaining-print-time only supports R = remainig print time
// https://www.klipper3d.org/G-Codes.html - only supports P = percent
function setProgress(percent: number) {
    return `M73 P${percent} R${5.0 / percent} ; Print progress\n`;
}

// Decimal round
function roundDecimal(value: number, exp: number): number {
    let bigVal = new Big(value);
    return bigVal.round(exp, Big.roundUp).toNumber();
}

// print a line between current position and target
function createLine(coordX: number, coordY: number, length: number, basicSettings: BasicSettings, optional?: object) {
    // handle optional function arguments passed as object
    var defaults = {
        speed: basicSettings.printSpeed,
        extMult: basicSettings.extMult,
        comment: ' ; print line\n'
    };
    var optArgs =  Object.assign(defaults, optional);

    const ext = roundDecimal(basicSettings.extRatio * optArgs.extMult * Math.abs(length), 4);

    return 'G1 X' + roundDecimal(rotateX(coordX, basicSettings.centerX, coordY, basicSettings.centerY, basicSettings.printDir), 4) +
            ' Y' + roundDecimal(rotateY(coordX, basicSettings.centerX, coordY, basicSettings.centerY, basicSettings.printDir), 4) +
            ' E' + ext + ' F' + optArgs.speed + optArgs.comment;
}

// move print head to coordinates
function moveTo(coordX: number, coordY: number, basicSettings: BasicSettings) {
    return setAcceleration('travel', basicSettings) +
        'G1 X' + roundDecimal(rotateX(coordX, basicSettings.centerX, coordY, basicSettings.centerY, basicSettings.printDir), 4) +
        ' Y' + roundDecimal(rotateY(coordX, basicSettings.centerX, coordY, basicSettings.centerY, basicSettings.printDir), 4) +
        ' F' + basicSettings.travelSpeed + ' ; move to start\n' +
        setAcceleration('print', basicSettings);
}

function setAcceleration(rate: 'print' | 'travel' | 'test', basicSettings: BasicSettings): string {
    // acceleration is 'built different' across the various firmwares:
    // klipper: https://www.klipper3d.org/G-Codes.html
    //     * Note: If S is not specified and both P and T are specified, then the acceleration is set to the minimum of P and T.
    //              If only one of P or T is specified, the command has no effect.
    // Prusa: https://help.prusa3d.com/article/prusa-firmware-specific-g-codes_112173
    //     * P = print, R = filament moves only, T = travel but is ignored
    // Marlin: https://marlinfw.org/docs/gcode/M204.html
    //     * Support P = print moves, T = Travel Moves
    // RRF: https://docs.duet3d.com/User_manual/Reference/Gcodes#m204-set-printing-and-travel-accelerations
    //     * Support P = print move, T = travel moves

    // so setting both P and T to the same value and setting accel before every move type is only consistent thing between them
    let feedRate: number = {
            'print': basicSettings.printAcceleration,
            'travel': basicSettings.travelAcceleration,
            'test': basicSettings.testAcceleration
        }[rate];

    return `M204 P${feedRate} T${feedRate}; Set ${rate} acceleration\n`;
}

// create retract / un-retract gcode
function doEfeed(dir: string, basicSettings: BasicSettings) {
    if (dir === '+') {
        return `G1 E${basicSettings.unretractDist} F${basicSettings.unretractSpeed} ; un-retract\n`;
    }
    else {
        return `G1 E-${basicSettings.retractDist} F${basicSettings.retractSpeed} ; retract\n`;
    }
}

// gcode for small z hop
function zHop(basicSettings: BasicSettings) {
    return 'G1 Z' + roundDecimal(basicSettings.zHopHeight, 3) + ' F' + basicSettings.travelSpeedZ + ' ; zHop\n';
}

// create standard test pattern
function createStdPattern(startX: number, startY: number, basicSettings: BasicSettings, patSettings: PatternSettings) {
    var lineOffset = 0,
        gcode = '';

        for (var i = 0; i < patSettings.advanceLines.length; i++) {
            let paValue: number = patSettings.advanceLines[i];
            
            gcode += patSettings.advanceGCodePrefix + roundDecimal(paValue, 3) + ' ; set Pressure Advance\n' +
                    'M117 Pressure Advance = ' + roundDecimal(paValue, 3) + ' ; \n' +
                    doEfeed('+', basicSettings) +
                    setAcceleration('test', basicSettings) +
                    createLine(startX + patSettings.lengthSlow, startY + lineOffset, patSettings.lengthSlow, basicSettings, {'speed': basicSettings.slowSpeed}) +
                    createLine(startX + patSettings.lengthSlow + patSettings.lengthFast, startY + lineOffset, patSettings.lengthFast, basicSettings, {'speed': basicSettings.fastSpeed}) +
                    createLine(startX + (2 * patSettings.lengthSlow) + patSettings.lengthFast, startY + lineOffset, patSettings.lengthSlow, basicSettings, {'speed': basicSettings.slowSpeed}) +
                    setAcceleration('print', basicSettings) +
                    doEfeed('-', basicSettings);
                    gcode += (i !== patSettings.advanceLines.length - 1 ? moveTo(startX, startY + lineOffset + patSettings.lineSpacing, basicSettings) : '');
            lineOffset += patSettings.lineSpacing;
    }
    gcode += setAcceleration('print', basicSettings);
    return gcode;
}

// create digits for K line numbering
function createGlyphs(startX: number, startY: number, basicSettings: BasicSettings, value: number) {
    var glyphSegHeight = 2,
        glyphSegHeight2 = 0.4,
        glyphSpacing = 3.0,
        glyphString = '',
        xCount = 0,
        yCount = 0,
        sNumber = value.toString(),
        glyphSeg: Map<string, Array<string>> = new Map<string, Array<string>>([
            ['1', ['up', 'up']],
            ['2', ['mup', 'mup', 'right', 'down', 'left', 'down', 'right']],
            ['3', ['mup', 'mup', 'right', 'down', 'down', 'left', 'mup', 'right']],
            ['4', ['mup', 'mup', 'down', 'right', 'mup', 'down', 'down']],
            ['5', ['right', 'up', 'left', 'up', 'right']],
            ['6', ['mup', 'right', 'down', 'left', 'up', 'up', 'right']],
            ['7', ['mup', 'mup', 'right', 'down', 'down']],
            ['8', ['mup', 'right', 'down', 'left', 'up', 'up', 'right', 'down']],
            ['9', ['right', 'up', 'left', 'up', 'right', 'down']],
            ['0', ['right', 'up', 'up', 'left', 'down', 'down']],
            ['.', ['dot']]
        ]);

    for (var i = 0, len = sNumber.length; i < len; i += 1) {
        const glyph = glyphSeg.get(sNumber.charAt(i));
        if (!glyph) {
            throw "unknown glyph";
        }
        for (var key in glyph) {
            const glyphStroke = glyph[key];
            if (glyph.hasOwnProperty(key)) {
                const up = createLine(startX + (xCount * glyphSegHeight), startY + (yCount * glyphSegHeight) + glyphSegHeight, glyphSegHeight, basicSettings, {'comment': ' ; ' + sNumber.charAt(i) + '\n'}),
                down = createLine(startX + (xCount * glyphSegHeight), startY + (yCount * glyphSegHeight) - glyphSegHeight, glyphSegHeight, basicSettings, {'comment': ' ; ' + sNumber.charAt(i) + '\n'}),
                right = createLine(startX + (xCount * glyphSegHeight) + glyphSegHeight, startY + (yCount * glyphSegHeight), glyphSegHeight, basicSettings, {'comment': ' ; ' + sNumber.charAt(i) + '\n'}),
                left = createLine(startX + (xCount * glyphSegHeight) - glyphSegHeight, startY + (yCount * glyphSegHeight), glyphSegHeight, basicSettings, {'comment': ' ; ' + sNumber.charAt(i) + '\n'}),
                
                mup = moveTo(startX + (xCount * glyphSegHeight), startY + (yCount * glyphSegHeight) + glyphSegHeight, basicSettings),
                dot = createLine(startX, startY + glyphSegHeight2, glyphSegHeight2, basicSettings, {comment: ' ; dot\n'});

                if (glyphStroke === 'up') {
                    glyphString += up;
                    yCount += 1;
                } else if (glyphStroke === 'down') {
                    glyphString += down;
                    yCount -= 1;
                } else if (glyphStroke === 'right') {
                    glyphString += right;
                    xCount += 1;
                } else if (glyphStroke === 'left') {
                    glyphString += left;
                    xCount -= 1;
                } else if (glyphStroke === 'mup') {
                    glyphString += mup;
                    yCount += 1;
                } else if (glyphStroke === 'dot') {
                    glyphString += dot;
                }
            }
        }
        if (sNumber.charAt(i) === '1' || sNumber.charAt(i) === '.') {
        startX += 1;
        } else {
        startX += glyphSpacing;
        }
        if (i !== sNumber.length - 1) {
        glyphString += doEfeed('-', basicSettings) +
                        moveTo(startX, startY, basicSettings) +
                        doEfeed('+', basicSettings);
        }
        yCount = 0;
        xCount = 0;
    }
    return glyphString;
}

// rotate x around a defined center xm, ym
function rotateX(x: number, xm: number, y: number, ym: number, a: number): number {
    a = a * Math.PI / 180; // Convert to radians
    var cos = Math.cos(a),
        sin = Math.sin(a);

    // Subtract midpoints, so that midpoint is translated to origin
    // and add it in the end again
    //var xr = (x - xm) * cos - (y - ym) * sin + xm; //CCW
    var xr = (cos * (x - xm)) + (sin * (y - ym)) + xm; //CW
    return xr;
}

// rotate y around a defined center xm, ym
function rotateY(x: number, xm: number, y: number, ym: number, a: number): number {
    a = a * Math.PI / 180; // Convert to radians
    var cos = Math.cos(a),
        sin = Math.sin(a);

    // Subtract midpoints, so that midpoint is translated to origin
    // and add it in the end again
    //var yr = (x - xm) * sin + (y - ym) * cos + ym; //CCW
    var yr = (cos * (y - ym)) - (sin * (x - xm)) + ym; //CW
    return yr;
}