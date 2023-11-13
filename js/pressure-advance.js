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
'use strict';

// Settings version of localStorage
// Increase if default settings are changed / amended
const SETTINGS_VERSION = '1.1';

const LINE_SPACING =  4.0;

function validateAdvanceParameters(calibrationParams) {
    var BED_SHAPE = calibrationParams.get('BED_SHAPE'),
        BED_X = calibrationParams.get('BED_X'),
        BED_Y = calibrationParams.get('BED_Y'),
        ADVANCE_START = calibrationParams.get('ADVANCE_START'),
        ADVANCE_END = calibrationParams.get('ADVANCE_END'),
        ADVANCE_STEP = calibrationParams.get('ADVANCE_STEP'),
        PRINT_DIR = calibrationParams.get('PRINT_DIR'),
        LENGTH_SLOW = calibrationParams.get('LENGTH_SLOW'),
        LENGTH_FAST = calibrationParams.get('LENGTH_FAST');

    const sizeY = ((ADVANCE_END - ADVANCE_START) / ADVANCE_STEP) * LINE_SPACING + 25, // +25 with ref marking
        sizeX = (2 * LENGTH_SLOW) + LENGTH_FAST + 8,
        printDirRad = PRINT_DIR * Math.PI / 180,
        fitWidth = round10(Math.abs(sizeX * Math.cos(printDirRad)) + Math.abs(sizeY * Math.sin(printDirRad)), 0),
        fitHeight = round10(Math.abs(sizeX * Math.sin(printDirRad)) + Math.abs(sizeY * Math.cos(printDirRad)), 0),
        decimals = getDecimals(ADVANCE_STEP);

    // parameters wont result in a whole number of steps
    // TODO: maybe we could change this to start, stepSize and steps... so people don't have to think about this one
    if (((round10(ADVANCE_END - ADVANCE_START, -3) * Math.pow(10, decimals)) % (ADVANCE_STEP * Math.pow(10, decimals))) !== 0) {
        throw `Pressure Advance Step (${ADVANCE_STEP}) does not divide the test range (from ${ADVANCE_START} to ${ADVANCE_END}) evenly`;
    }

    // print is too big for a round bed
    if (BED_SHAPE === 'Round') {
        if ((Math.sqrt(Math.pow(fitWidth, 2) + Math.pow(fitHeight, 2)) > BED_X)) {
            throw `TestPattern size (x: ${fitWidth}mm, y: ${fitHeight}mm) exceeds your bed's diameter (${BED_X}mm).`;
        }
    }
    // print is too big for a square bed
    else if (fitWidth > BED_X || fitHeight > BED_Y) {
        throw `'Test pattern size (x: ${fitWidth}mm, y: ${fitHeight}mm) exceeds your bed's usable size (x: (${BED_X}mm y: (${BED_Y}mm).'`;
    }
}

function genGcode(calibrationParams) {
    // get the values from the HTML elements
    var PRINTER = calibrationParams.get('PRINTER'),
        FILAMENT = calibrationParams.get('FILAMENT'),
        FILAMENT_TEMPERATURE = calibrationParams.get('FILAMENT_TEMPERATURE'),
        FILAMENT_DIAMETER = calibrationParams.get('FILAMENT_DIAMETER'),
        NOZZLE_DIAMETER = calibrationParams.get('NOZZLE_DIAMETER'),
        NOZZLE_LINE_RATIO = calibrationParams.get('NOZZLE_LINE_RATIO'),
        ACCELERATION = calibrationParams.get('ACCELERATION'),
        SPEED_SLOW = calibrationParams.get('SPEED_SLOW'),
        SPEED_FAST = calibrationParams.get('SPEED_FAST'),
        SPEED_MOVE = calibrationParams.get('SPEED_MOVE'),
        SPEED_MOVE_Z = calibrationParams.get('SPEED_MOVE_Z'),
        RETRACT_SPEED = calibrationParams.get('RETRACT_SPEED'),
        UNRETRACT_SPEED = calibrationParams.get('UNRETRACT_SPEED'),
        RETRACT_DIST = calibrationParams.get('RETRACT_DIST'),
        UNRETRACT_DIST = calibrationParams.get('UNRETRACT_DIST'),
        BED_SHAPE = calibrationParams.get('BED_SHAPE'),
        BED_X = calibrationParams.get('BED_X'),
        BED_Y = calibrationParams.get('BED_Y'),
        NULL_CENTER = calibrationParams.get('NULL_CENTER'),
        HEIGHT_LAYER = calibrationParams.get('HEIGHT_LAYER'),
        TOOL_INDEX = calibrationParams.get('TOOL_INDEX'),
        FAN_SPEED = calibrationParams.get('FAN_SPEED'),
        EXT_MULT = calibrationParams.get('EXT_MULT'),
        VERSION_LIN = calibrationParams.get('VERSION_LIN'),
        ADVANCE_START = calibrationParams.get('ADVANCE_START'),
        ADVANCE_END = calibrationParams.get('ADVANCE_END'),
        ADVANCE_STEP = calibrationParams.get('ADVANCE_STEP'),
        PRINT_DIR = calibrationParams.get('PRINT_DIR'),
        LENGTH_SLOW = calibrationParams.get('LENGTH_SLOW'),
        LENGTH_FAST = calibrationParams.get('LENGTH_FAST'),
        ADVANCE_GCODE_PREFIX = calibrationParams.get('ADVANCE_GCODE_PREFIX'),
        Z_OFFSET = 0;


    if (BED_SHAPE === 'Round') {
        BED_Y = BED_X;
    }

    // convert mm/s to mm/minute
    SPEED_SLOW *= 60;
    SPEED_FAST *= 60;
    SPEED_MOVE *= 60;
    SPEED_MOVE_Z *= 60;
    RETRACT_SPEED *= 60;
    UNRETRACT_SPEED *= 60;

    var RANGE_K = ADVANCE_END - ADVANCE_START,
        PRINT_SIZE_Y = (RANGE_K / ADVANCE_STEP * LINE_SPACING) + 25, // +25 with ref marking
        PRINT_SIZE_X = (2 * LENGTH_SLOW) + LENGTH_FAST  + 8,
        CENTER_X = (NULL_CENTER ? 0 : BED_X / 2),
        CENTER_Y = (NULL_CENTER ? 0 : BED_Y / 2),
        PAT_START_X = CENTER_X - (0.5 * LENGTH_FAST) - LENGTH_SLOW - 4,
        PAT_START_Y = CENTER_Y - (PRINT_SIZE_Y / 2),
        LINE_WIDTH = NOZZLE_DIAMETER * NOZZLE_LINE_RATIO,
        EXTRUSION_RATIO = LINE_WIDTH * HEIGHT_LAYER / (Math.pow(FILAMENT_DIAMETER / 2, 2) * Math.PI),
        printDirRad = PRINT_DIR * Math.PI / 180,
        FIT_WIDTH = Math.abs(PRINT_SIZE_X * Math.cos(printDirRad)) + Math.abs(PRINT_SIZE_Y * Math.sin(printDirRad)),
        FIT_HEIGHT = Math.abs(PRINT_SIZE_X * Math.sin(printDirRad)) + Math.abs(PRINT_SIZE_Y * Math.cos(printDirRad));

    var basicSettings = {
        'slow': SPEED_SLOW,
        'fast': SPEED_FAST,
        'slow_z': SPEED_MOVE_Z,
        'move': SPEED_MOVE,
        'centerX': CENTER_X,
        'centerY': CENTER_Y,
        'printDir': PRINT_DIR,
        'lineWidth': LINE_WIDTH,
        'extRatio': EXTRUSION_RATIO,
        'extMult': EXT_MULT,
        'retractDist': RETRACT_DIST,
        'unretractDist': UNRETRACT_DIST,
        'retractSpeed' : RETRACT_SPEED,
        'unretractSpeed' : UNRETRACT_SPEED,
    };

    var patSettings = {
        'advanceGCodePrefix': ADVANCE_GCODE_PREFIX,
        'lengthSlow' : LENGTH_SLOW,
        'lengthFast': LENGTH_FAST,
        'kStart' : ADVANCE_START,
        'kEnd' : ADVANCE_END,
        'kStep' : ADVANCE_STEP,
        'lineSpacing' : LINE_SPACING
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
                    `; Extruder = ${TOOL_INDEX} \n` +
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
                    `; Travel Speed = ${SPEED_MOVE} mm/min\n` +
                    `; Retract Speed = ${RETRACT_SPEED} mm/min\n` +
                    `; Unretract Speed = ${UNRETRACT_SPEED} mm/min\n` +
                    `; Printing Acceleration = ${ACCELERATION} mm/s^2\n` +
                    `;\n` +
                    `; Settings Pattern:\n` +
                    `; Pressure Advance Type = ${VERSION_LIN}\n` +
                    `; Starting Value = ${ADVANCE_START}\n` +
                    `; Ending Value = ${ADVANCE_END}\n` +
                    `; Factor Stepping = ${ADVANCE_STEP}\n` +
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
    k_script += 'G1 Z' + (HEIGHT_LAYER + Z_OFFSET) + ' F' + SPEED_SLOW + ' ; Move to layer height\n';

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

    // Turn off pressure advance for the rest of the print
    k_script += ';\n' +
                'M117 Pressure Advance = 0\n' +
                `${ADVANCE_GCODE_PREFIX}0 ; Set Pressure Advance: 0\n`;

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
                zHop((HEIGHT_LAYER + Z_OFFSET) + 0.1, basicSettings);

    // print K values beside the test lines
    var numStartX = CENTER_X + (0.5 * LENGTH_FAST) + LENGTH_SLOW  - 2,
        numStartY = PAT_START_Y - 2,
        stepping = 0;

    k_script += ';\n' +
                '; print K-value next to lines\n' +
                ';\n';

    for (var i = ADVANCE_START; i <= ADVANCE_END; i += ADVANCE_STEP) {
        if (stepping % 2 === 0) {
            k_script += moveTo(numStartX, numStartY + (stepping * LINE_SPACING), basicSettings) +
                        zHop((HEIGHT_LAYER + Z_OFFSET), basicSettings) +
                        doEfeed('+', basicSettings) +
                        createGlyphs(numStartX, numStartY + (stepping * LINE_SPACING), basicSettings, round10(i, -3)) +
                        doEfeed('-', basicSettings) +
                        zHop((HEIGHT_LAYER + Z_OFFSET) + 0.1, basicSettings);
        }
        stepping += 1;
    }

  return k_script;
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round
/**
 * Decimal adjustment of a number.
 *
 * @param {String}  type  The type of adjustment.
 * @param {Number}  value The number.
 * @param {Integer} exp   The exponent (the 10 logarithm of the adjustment base).
 * @returns {Number} The adjusted value.
 */

function decimalAdjust(type, value, exp) {
    // If the exp is undefined or zero...
    if (typeof exp === 'undefined' || Number(exp) === 0) {
    return Math[type](value);
    }
    value = Number(value);
    exp = Number(exp);
    // If the value is not a number or the exp is not an integer...
    if (value === null || isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
    return NaN;
    }
    // If the value is negative...
    if (value < 0) {
    return -decimalAdjust(type, -value, exp);
    }
    // Shift
    value = value.toString().split('e');
    value = Math[type](Number(value[0] + 'e' + (value[1] ? (Number(value[1]) - exp) : -exp)));
    // Shift back
    value = value.toString().split('e');
    return Number(value[0] + 'e' + (value[1] ? (Number(value[1]) + exp) : exp));
}

// Decimal round
function round10(value, exp) {
    return decimalAdjust('round', value, exp);
}

// get the number of decimal places of a float
function getDecimals(num) {
    var match = (String(num)).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
    if (!match) {
        return num;
    }
    var decimalPlaces = Math.max(0, (match[1] ? match[1].length : 0) - (match[2] ? Number(match[2]) : 0));
    return decimalPlaces;
}

// print a line between current position and target
function createLine(coordX, coordY, length, basicSettings, optional) {
    //handle optional function arguements passed as object
    var defaults = {
        speed: basicSettings['slow'],
        extMult: basicSettings['extMult'],
        comment: ' ; print line\n'
    };
    var optArgs =  Object.assign(defaults, optional);

    const ext = round10(basicSettings['extRatio'] * optArgs['extMult'] * Math.abs(length), -4);

    return 'G1 X' + round10(rotateX(coordX, basicSettings['centerX'], coordY, basicSettings['centerY'], basicSettings['printDir']), -4) +
                ' Y' + round10(rotateY(coordX, basicSettings['centerX'], coordY, basicSettings['centerY'], basicSettings['printDir']), -4) +
                ' E' + ext + ' F' + optArgs['speed'] + optArgs['comment'];
}

// move print head to coordinates
function moveTo(coordX, coordY, basicSettings) {
    return 'G1 X' + round10(rotateX(coordX, basicSettings['centerX'], coordY, basicSettings['centerY'], basicSettings['printDir']), -4) +
                ' Y' + round10(rotateY(coordX, basicSettings['centerX'], coordY, basicSettings['centerY'], basicSettings['printDir']), -4) +
                ' F' + basicSettings['move'] + ' ; move to start\n';
}

// create retract / un-retract gcode
function doEfeed(dir, basicSettings) {
    if (dir === '+') {
        return `G1 E${basicSettings['unretractDist']} F${basicSettings['unretractSpeed']} ; un-retract\n`;
    }
    else {
        return `G1 E-${basicSettings['retractDist']} F${basicSettings['retractSpeed']} ; retract\n`;
    }
}

// gcode for small z hop
function zHop(hop, basicSettings) {
    return 'G1 Z' + round10(hop, -3) + ' F' + basicSettings['slow'] + ' ; zHop\n';
}

// create standard test pattern
function createStdPattern(startX, startY, basicSettings, patSettings) {
    var j = 0,
        gcode = '';

    for (var i = patSettings['kStart']; i <= patSettings['kEnd']; i += patSettings['kStep']) {
        gcode += patSettings['advanceGCodePrefix'] + round10(i, -3) + ' ; set Pressure Advance\n' +
                'M117 Pressure Advance = ' + round10(i, -3) + ' ; \n' +
                doEfeed('+', basicSettings) +
                createLine(startX + patSettings['lengthSlow'], startY + j, patSettings['lengthSlow'], basicSettings, {'speed': basicSettings['slow']}) +
                createLine(startX + patSettings['lengthSlow'] + patSettings['lengthFast'], startY + j, patSettings['lengthFast'], basicSettings, {'speed': basicSettings['fast']}) +
                createLine(startX + (2 * patSettings['lengthSlow']) + patSettings['lengthFast'], startY + j, patSettings['lengthSlow'], basicSettings, {'speed': basicSettings['slow']}) +
                doEfeed('-', basicSettings) +
                (i !== patSettings['kEnd'] ? moveTo(startX, startY + j + patSettings['lineSpacing'], basicSettings) : '');
        j += patSettings['lineSpacing'];
    }
    return gcode;
}

// create digits for K line numbering
function createGlyphs(startX, startY, basicSettings, value) {
    var glyphSegHeight = 2,
        glyphSegHeight2 = 0.4,
        glyphSpacing = 3.0,
        glyphString = '',
        xCount = 0,
        yCount = 0,
        sNumber = value.toString(),
        glyphSeg = {
            '1': ['up', 'up'],
            '2': ['mup', 'mup', 'right', 'down', 'left', 'down', 'right'],
            '3': ['mup', 'mup', 'right', 'down', 'down', 'left', 'mup', 'right'],
            '4': ['mup', 'mup', 'down', 'right', 'mup', 'down', 'down'],
            '5': ['right', 'up', 'left', 'up', 'right'],
            '6': ['mup', 'right', 'down', 'left', 'up', 'up', 'right'],
            '7': ['mup', 'mup', 'right', 'down', 'down'],
            '8': ['mup', 'right', 'down', 'left', 'up', 'up', 'right', 'down'],
            '9': ['right', 'up', 'left', 'up', 'right', 'down'],
            '0': ['right', 'up', 'up', 'left', 'down', 'down'],
            '.': ['dot']
        };

    for (var i = 0, len = sNumber.length; i < len; i += 1) {
        for (var key in glyphSeg[sNumber.charAt(i)]) {
        if(glyphSeg[sNumber.charAt(i)].hasOwnProperty(key)) {
            var up = createLine(startX + (xCount * glyphSegHeight), startY + (yCount * glyphSegHeight) + glyphSegHeight, glyphSegHeight, basicSettings, {'speed': basicSettings['slow'], 'comment': ' ; ' + sNumber.charAt(i) + '\n'}),
                down = createLine(startX + (xCount * glyphSegHeight), startY + (yCount * glyphSegHeight) - glyphSegHeight, glyphSegHeight, basicSettings, {'speed': basicSettings['slow'], 'comment': ' ; ' + sNumber.charAt(i) + '\n'}),
                right = createLine(startX + (xCount * glyphSegHeight) + glyphSegHeight, startY + (yCount * glyphSegHeight), glyphSegHeight, basicSettings, {'speed': basicSettings['slow'], 'comment': ' ; ' + sNumber.charAt(i) + '\n'}),
                left = createLine(startX + (xCount * glyphSegHeight) - glyphSegHeight, startY + (yCount * glyphSegHeight), glyphSegHeight, basicSettings, {'speed': basicSettings['slow'], 'comment': ' ; ' + sNumber.charAt(i) + '\n'}),
                mup = moveTo(startX + (xCount * glyphSegHeight), startY + (yCount * glyphSegHeight) + glyphSegHeight, basicSettings),
                dot = createLine(startX, startY + glyphSegHeight2, glyphSegHeight2, basicSettings, {speed: basicSettings['slow'], comment: ' ; dot\n'});
            if (glyphSeg[sNumber.charAt(i)][key] === 'up') {
            glyphString += up;
            yCount += 1;
            } else if (glyphSeg[sNumber.charAt(i)][key] === 'down') {
            glyphString += down;
            yCount -= 1;
            } else if (glyphSeg[sNumber.charAt(i)][key] === 'right') {
            glyphString += right;
            xCount += 1;
            } else if (glyphSeg[sNumber.charAt(i)][key] === 'left') {
            glyphString += left;
            xCount -= 1;
            } else if (glyphSeg[sNumber.charAt(i)][key] === 'mup') {
            glyphString += mup;
            yCount += 1;
            } else if (glyphSeg[sNumber.charAt(i)][key] === 'dot') {
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
function rotateX(x, xm, y, ym, a) {
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
function rotateY(x, xm, y, ym, a) {
    a = a * Math.PI / 180; // Convert to radians
    var cos = Math.cos(a),
        sin = Math.sin(a);

    // Subtract midpoints, so that midpoint is translated to origin
    // and add it in the end again
    //var yr = (x - xm) * sin + (y - ym) * cos + ym; //CCW
    var yr = (cos * (y - ym)) - (sin * (x - xm)) + ym; //CW
    return yr;
}