import type { RequiredSlicerSettings } from "./GcodeProcessor";
import { evaluateGcodeTemplate } from "./PrusaGcodeTemplateEvaluator";
import type { TestPatternConfiguration } from "./TestPatternConfiguration";

// find the last call to M109 which is when the hotend temp is set to the print temp
function setFilamentTemperature(startLines: Array<string>, temp: number, toolIndex: number) {
    const tempRegex = /(M109 .*S)(\d{2,3})(.*)/;
    // looking for the LAST time that temp wait (M109) was used in start gcode
    // (so, eg, if other tools get shut off after it wont catch those)
    for (var i = startLines.length - 1; i > 0; i--) {
        const line = startLines[i];
        if (line.match(tempRegex)) {
            // replace temp in the existing line
            startLines[i] = line.replace(tempRegex, '$1' + temp + '$3');
            return true;
        }
    }
    throw "Could not find M109 in <pre>start_gcode</pre>";
}

function replaceM555(startLines: Array<string>, patternConfig: TestPatternConfiguration): boolean {
    let m555_line = -1;
    for (var i = startLines.length - 1; i > 0; i--) { 
        if (startLines[i].startsWith('M555 ')) {
            m555_line = i;
            break;
        }
    }

    if (m555_line === -1) {
        return false;
    }

    let printArea = patternConfig.print_area.value;
    startLines[m555_line] = `M555 X${printArea.x} Y${printArea.y} W${printArea.width} H${printArea.height}`;
    return true;
}

function extractThumbnail(startLines: Array<string>): Array<string> {
    let i: number = 0;
    for (; i < startLines.length; i++) {
        const line = startLines[i].trim();
        if (!(line.startsWith(';') || line.length === 0)) {
            return startLines.slice(0, i);
        }
    }
    return startLines;
}

function klipperStartGocde(startLines: Array<string>, endLines: Array<string>, startGcode: string, settings: RequiredSlicerSettings, patternConfig: TestPatternConfiguration) {
    const objectName = 'pressure_advance_calibration_test',
        startBlock = startLines.join(''),
        thumbnail = extractThumbnail(startLines),
        hasExcludeObject = startBlock.indexOf('EXCLUDE_OBJECT_DEFINE') > -1,
        printArea = patternConfig.print_area.value,
        x = printArea.x,
        y = printArea.y,
        xMax = (printArea.x + printArea.width),
        yMax = (printArea.y + printArea.height),
        xCenter = (x + (printArea.width / 2)).toFixed(3),
        yCenter = (y + (printArea.height / 2)).toFixed(3),
        temp = '' + patternConfig.filament_temperature.value,
        bedTemp = '' + settings.first_layer_temperature.toValue(),
        replacements: Map<string, string[]> = new Map([
            // bare minimum set of variables that klipper users are likely to need
            ['temperature', [temp, temp, temp, temp, temp]],
            ['bed_temperature', [bedTemp, bedTemp, bedTemp, bedTemp, bedTemp]],
            ['first_layer_temperature', [temp, temp, temp, temp, temp]],
            ['first_layer_bed_temperature', [bedTemp, bedTemp, bedTemp, bedTemp, bedTemp]],
            ['first_layer_print_min', [`${x}`, `${y}`]],
            ['first_layer_print_max', [`${xMax}`, `${yMax}`]],
            ['first_layer_size', [`${printArea.width}`, `${printArea.height}`]],
        ])
    // clear the start lines, we don't need them now
    startLines.splice(0, startLines.length);
    startLines.push(...thumbnail);
    // define exclude object if using
    if (hasExcludeObject) {
        startLines.push(`EXCLUDE_OBJECT_DEFINE NAME=${objectName} CENTER=${xCenter},${yCenter} POLYGON=[[${x},${y}],[${x},${yMax}],[${xMax},${yMax}],[${xMax},${y}]]`);
        
    }
    // re-evaluate the start gcode template
    startLines.push(...evaluateGcodeTemplate(startGcode, replacements));
    console.log(startLines);
    // add the recommended SCV override
    // im not going to override acceleration, you should set your printer up to hit the limits n the slicer.
    // changing hardware limits could be harmful to the printer
    startLines.push(`\nSET_VELOCITY_LIMIT SQUARE_CORNER_VELOCITY=1\n`);
    // srap the print in start/end object calls
    if (hasExcludeObject) {
        startLines.push(`EXCLUDE_OBJECT_START NAME=${objectName}`)
        endLines.unshift(`EXCLUDE_OBJECT_END NAME=${objectName}`);
    }
}

// This only needs to be done if the first layer temp is less than the filament temp
// TODO: it would be nice to prepare an diff so the user can inspect it. Like the changed bits in bold or something
export function prepareStartEndGcode(settings: RequiredSlicerSettings, patternConfig: TestPatternConfiguration) {
    // Klipper
    let gcodeFlavour: string = settings.gcode_flavor.toValue();
    if (gcodeFlavour === 'klipper') {
        klipperStartGocde(patternConfig.startLines, patternConfig.endLines, settings.start_gcode.toValue(), settings, patternConfig);
        return;
    }

    // Prusa Marlin & RRF
    let toolIndex: number = settings.perimeter_extruder.toValue() - 1;
    let firstLayerTemp = settings.first_layer_temperature.toValue();
    let filamentTemp = patternConfig.filament_temperature.value;

    // in start gcode the extruder is set to the first layer temp.
    // if the test filament temp is not the same then we change it:
    if (firstLayerTemp !== filamentTemp) {
        setFilamentTemperature(patternConfig.startLines, filamentTemp, toolIndex);
    }
    // update M555 line is present
    replaceM555(patternConfig.startLines, patternConfig);
}

