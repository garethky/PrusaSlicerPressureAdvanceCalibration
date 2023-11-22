import type { RequiredSlicerSettings } from "./GcodeProcessor";
import type { TestPatternConfiguration } from "./TestPatternConfiguration";

// find the last call to M109 which is when the hotend temp is set to the print temp
function setFilamentTemperature(startLines: Array<string>, temp: number, toolIndex: number): boolean {
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

    // T<index> : klipper, marlin and RRF all support this. RRF says its deprecated but is still in the docs.
    startLines.push(`M109 T${toolIndex} S${temp}`);
    return false; // not found, likely means the user has a macro on the machine that does it
}

// add the recommended SCV override
// im not going to override acceleration, you should set your printer up to hit the limits n the slicer.
// changing hardware limits could be harmful to the printer
function addKlipperScvOverride(startLines: Array<string>) {
    startLines.push(`SET_VELOCITY_LIMIT SQUARE_CORNER_VELOCITY=1`);
}

// This only needs to be done if the first layer temp is less than the filament temp
// TODO: it would be nice to prepare an diff so the user can inspect it. Like the changed bits in bold or something
export function prepareStartGcode(startLines: Array<string>, settings: RequiredSlicerSettings, patternConfig: TestPatternConfiguration) {
    let toolIndex: number = settings.perimeter_extruder.toValue() - 1;
    let firstLayerTemp = settings.first_layer_temperature.toValue();
    let filamentTemp = patternConfig.filament_temperature.value;

    // in start gcode the extruder is set to the first layer temp.
    // if the test filament temp is not the same then we change it:
    if (firstLayerTemp !== filamentTemp) {
        setFilamentTemperature(startLines, filamentTemp, toolIndex);
    }

    let gcodeFlavour: string = settings.gcode_flavor.toValue();
    if (gcodeFlavour === 'klipper') {
        addKlipperScvOverride(startLines);
    }
}

