import type { TestPatternConfiguration } from "./TestPatternConfiguration";

function updateLastTemperatureCommand(startLines: Array<string>, temp: number): boolean {
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
    return false;
}

function appendM109(startLines: Array<string>, temp: number, toolIndex: number) {
    // T<index> : klipper, marlin and RRF all support this. RRF says its deprecated but is still in the docs.
    startLines.push(`M109 T${toolIndex} S${temp}`);
}

// This only needs to be done if the first layer temp is less than the filament temp
// TODO: it would be nice to prepare an diff so the user can inspect it. Like the changed bits in bold or something
export function prepareStartGcode(startLines: Array<string>, filament_temperature: number, tool_index: number) {
    // the gcode only needs to be changed if 
    if (!updateLastTemperatureCommand(startLines, filament_temperature)) {
        appendM109(startLines, filament_temperature, tool_index);
    }
}

