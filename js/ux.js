const requiredSettings = new Map();
requiredSettings.set("printer_model", [parseString, describeString, true]);
requiredSettings.set('gcode_flavor', [parseString, describeString, true]);
requiredSettings.set("filament_settings_id", [parseString, describeString, true]);
requiredSettings.set("bed_shape", [parseBedShape, describeBedShape, true]);
requiredSettings.set("perimeter_extruder", [parseSingleInt, describeNumber, true]);
requiredSettings.set("nozzle_diameter", [parseToolFloat, describeMm, true]);
requiredSettings.set("bed_temperature", [parseToolFloat, describeTemp, true]);
requiredSettings.set("external_perimeter_extrusion_width", [parseSingleFloat, describeMm, true]);
requiredSettings.set("extrusion_multiplier", [parseToolFloat, describeNumber, true]);
requiredSettings.set("temperature", [parseToolFloat, describeTemp, true]);
requiredSettings.set("first_layer_temperature", [parseToolFloat, describeTemp, true]);
requiredSettings.set("filament_diameter", [parseToolFloat, describeMm, true]);
requiredSettings.set("filament_retract_length", [parseToolFloat, describeMm, false]);
requiredSettings.set("filament_retract_lift", [parseToolFloat, describeMm, false]);
requiredSettings.set("infill_acceleration", [parseSingleInt, describeMms, true]);
requiredSettings.set("perimeter_acceleration", [parseSingleInt, describeMms, true]);
requiredSettings.set("perimeter_extrusion_width", [parseSingleFloat, describeMm, true]);
requiredSettings.set("perimeter_speed", [parseSingleInt, describeMms, true]);
requiredSettings.set("travel_speed", [parseSingleInt, describeMms, true]);
requiredSettings.set("travel_speed_z", [parseSingleInt, describeMms, true]);
requiredSettings.set('retract_length', [parseToolFloat, describeMm, true]);
requiredSettings.set('retract_before_travel', [parseToolFloat, describeMm, true]);
requiredSettings.set('retract_restart_extra', [parseToolFloat, describeMm, true]);
requiredSettings.set('retract_speed', [parseToolFloat, describeMms, true]);
requiredSettings.set('deretract_speed', [parseToolFloat, describeMms, true]);
requiredSettings.set('layer_height', [parseFloat, describeMm, true]);
requiredSettings.set('disable_fan_first_layers', [parseToolFloat, describeNumber, true]);
requiredSettings.set('first_layer_speed', [parseFloat, describeMms, true]);
requiredSettings.set('min_fan_speed', [parseToolFloat, describePercent, true]);
requiredSettings.set('infill_speed', [parseFloat, describeMms, true]);
requiredSettings.set('max_volumetric_speed', [parseFloat, describeMmCubed, true]);
requiredSettings.set('filament_max_volumetric_speed', [parseFloat, describeMmCubed, false]);

/* Global State */
const PHASE_START = 0,
    PHASE_PARSING = 1,
    PHASE_VALIDATING = 2,
    PHASE_COMPLETE = 4;
const state = {
    phase: PHASE_START,
    settings: {},
    calibrationParams: new Map(),
    gcodeFileName: null,
    gcodeBlob: null,
    nozzleDiameter: 0.4,
    toolIndex: 0,
    pressureAdvanceCode: 'M572 S', 
}

function splitToTools(value, toolNumber) {
    toolValues = value.split(',');
    if (toolValues.length < toolNumber) {
        throw "value does not have enough entries for tool #" + toolNumber;
    }
    return toolValues[toolNumber - 1];
}

function parseString(value) {
    return '' + value;
}

function parseSingleInt(value) {
    return parseInt(value, 10);
}

function parseSingleFloat(value, key) {
    var val = parseFloat(value);
    if (isNaN(val)) {
        throw `Settings value ${key} = ${value} is not a number (parses to NaN)`
    }
    return parseFloat(value);
}

function parseToolFloat(value, toolNumber, key) {
    const splitValue = splitToTools(value, toolNumber);
    return parseSingleFloat(splitValue, key);
}

function parseBedShape(value) {
    const parts = value.split(',');
    if (parts.length === 4) {
        // Prusa defines the bed as 4 corners, the 3rd entry in the array is the max value for the x and y
        // if the first entry isnt 0x0, bail
        if (parts[0] !== '0x0') {
            throw "Square bed with non-zero origin found! This is not supported.";
        }
        bedMax = parts[2].split('x');
        return {
            shape: "Rect",
            x: bedMax[0],
            y: bedMax[1],
        }
    } else {
        throw "Round Beds are not supported yet... sorry :("
    }
}

function describeString(value) {
    return value;
}

function describeNumber(value) {
    return '' + value;
}

function describePercent(value) {
    return '' + value + ' %';
}

function describeMms(value) {
    return describeNumber(value) + ' mm/s';
}

function describeMm(value) {
    return describeNumber(value) + ' mm';
}

function describeMmCubed(value) {
    return describeNumber(value) + ' mm&sup3;';
}

function describeTemp(value) {
    return describeNumber(value) + ' &deg;C';
}

function describeBedShape(bed) {
    return [bed.shape, ": ", describeMm(bed.x) + " x " , describeMm(bed.y)].join('');
}

function processGcodeFile(gcode) {
    try {
        state.phase = PHASE_START;
        gcodeLines = gcode.split(/\r?\n/);
        // when to do this?
        gcodeLines = stripTypeCustom(gcodeLines);
        foundSettings = loadPrusaSlicerSettings(gcodeLines);
        foundSettings = checkRequiredSettings(foundSettings);
        state.settings = foundSettings;
        state.calibrationParams = buildCalibrationSettings(state.settings);
        onParsingSuccess();
        prepareTestGcode();
    }
    catch (exMessage) {
        onError(exMessage);
        throw exMessage;
    }
}

function prepareTestGcode() {
    onValidationsStart();
    try {
        // continue to the validation phase
        addPressureAdvance();
        validateAdvanceParameters(state.calibrationParams);
    }
    catch (exMessage) {
        onValidationError(exMessage);
        throw exMessage;
    }

    try {
        calibrationGCode = genGcode(state.calibrationParams);
        state.gcodeBlob = generateTestGCode(gcodeLines, calibrationGCode);
    }
    catch (exMessage) {
        onValidationError(exMessage);
        throw exMessage;
    }

    onValidationSuccess();
}

function buildCalibrationSettings(foundSettings) {
    const patternParams = new Map();
    const model = foundSettings.get('printer_model');
    guessExtruderType(model);
    patternParams.set('PRINTER', model);
    patternParams.set('FILAMENT', foundSettings.get('filament_settings_id'));
    patternParams.set('FILAMENT_DIAMETER', foundSettings.get('filament_diameter'));
    const temp = Math.max(foundSettings.get('temperature'), foundSettings.get('first_layer_temperature'));
    patternParams.set('FILAMENT_TEMPERATURE', temp);
    const nozzleDiameter = foundSettings.get('nozzle_diameter');
    state.nozzleDiameter = nozzleDiameter;
    patternParams.set('NOZZLE_DIAMETER', nozzleDiameter);
    const layerHeight = foundSettings.get('layer_height')
    patternParams.set('HEIGHT_LAYER', foundSettings.get('layer_height'));
    // the tool index should be the one printing the part you sliced
    toolIndex = foundSettings.get('perimeter_extruder') - 1;
    state.toolIndex = toolIndex;
    patternParams.set('TOOL_INDEX', foundSettings.get('perimeter_extruder') - 1);
    // extrusion width
    const extrusionWidth = foundSettings.get('perimeter_extrusion_width');
    patternParams.set('NOZZLE_LINE_RATIO', extrusionWidth / nozzleDiameter);
    patternParams.set('EXT_MULT', foundSettings.get('extrusion_multiplier'));

    patternParams.set('SPEED_SLOW', foundSettings.get('first_layer_speed'));
    const speedInfill = foundSettings.get('infill_speed');
    const maxVolumetricFlow = foundSettings.get('max_volumetric_speed');
    const maxFilamentVolumetricFlow = foundSettings.get('filament_max_volumetric_speed');
    var flowRate;
    if (!!maxFilamentVolumetricFlow && maxFilamentVolumetricFlow > 0) {
        flowRate = maxFilamentVolumetricFlow;
    } else if (maxVolumetricFlow > 0) {
        flowRate = maxVolumetricFlow;
    } else {
        throw 'No Volumetric Flow Rate setting was found other than 0';
    }
    const speedFast = calculateBestSpeed(speedInfill, layerHeight, extrusionWidth, flowRate);
    patternParams.set('SPEED_FAST', speedFast);
    patternParams.set('SPEED_MOVE', foundSettings.get('travel_speed'));
    patternParams.set('SPEED_MOVE_Z', foundSettings.get('travel_speed_z'));    
    patternParams.set('ACCELERATION', foundSettings.get('infill_acceleration'));
    patternParams.set('RETRACT_DIST', foundSettings.get('retract_length'));
    const unretract = foundSettings.get('retract_length') + foundSettings.get('retract_restart_extra');
    patternParams.set('UNRETRACT_DIST', unretract);
    patternParams.set('RETRACT_SPEED', foundSettings.get('retract_speed'));
    patternParams.set('UNRETRACT_SPEED', foundSettings.get('deretract_speed'));

    // bed shape
    patternParams.set('BED_SHAPE', foundSettings.get('bed_shape')['shape'].toUpperCase());
    patternParams.set('BED_X', foundSettings.get('bed_shape')['x']);
    patternParams.set('BED_Y', foundSettings.get('bed_shape')['y']);
    patternParams.set('NULL_CENTER', false);
    // turn fan off if disable_fan_first_layers is higher than 0
    // TODO: check that it is 0 and not 1
    fanOffLayer = foundSettings.get('disable_fan_first_layers');
    minFanSpeed = foundSettings.get('min_fan_speed');
    patternParams.set('FAN_SPEED', fanOffLayer > 0 ? 0 : minFanSpeed);


    patternParams.set('ADVANCE_GCODE_PREFIX', selectAdvanceGCodePrefix(foundSettings, toolIndex));

    patternParams.set('PRINT_DIR', 0.0);
    patternParams.set('LENGTH_SLOW', 25);
    patternParams.set('LENGTH_FAST', 100);
    patternParams.set('Z_OFFSET', 0.0);
    return patternParams;
}

// sometimes the max speed requested in a profile exceeds the max volumetric speed of the filament
// pick the min of volumetric flow rate limit and requested speed
function calculateBestSpeed(requestedSpeed, extrusionWidth, layerHeight, maxVolumetricFlow) {
    const maxSpeed = maxVolumetricFlow / (extrusionWidth * layerHeight);
    return Math.min(maxSpeed, requestedSpeed);
}

function addPressureAdvance() {
    const checkedOption = u('input[name="ADVANCE"]:checked').first().value;
    console.log(checkedOption);
    var start, end, step;
    if (checkedOption === 'direct-drive') {
        start = 0.0;
        end = 0.2;
        step = 0.01;
    }
    else if (checkedOption === 'bowden') {
        start = 0.0;
        end = 2.0;
        step = 0.1;
    } else {
        start = toNumber(u('#ADVANCE_START').first().value);
        end = toNumber(u('#ADVANCE_END').first().value);
        step = toNumber(u('#ADVANCE_STEP').first().value);
    }
    state.calibrationParams.set('ADVANCE_START', start);
    state.calibrationParams.set('ADVANCE_END', end);
    state.calibrationParams.set('ADVANCE_STEP', step);
}

function toNumber(value) {
    paValue = parseFloat(value);
    if (isNaN(paValue) || !isFinite(paValue)) {
        throw `value ${value} is not a number`;
    }
    return paValue;
}

function guessExtruderType(printerModel) {
    if(!!printerModel.match(/MINI|MINIIS/)) {
        onGuessExtruderType('bowden');
    } else {
        onGuessExtruderType('direct-drive');
    }
}

function selectAdvanceGCodePrefix(foundSettings, toolIndex) {
    flavour = foundSettings.get('gcode_flavor');
    printerModel = foundSettings.get('printer_model');
    if ('klipper'.localeCompare(flavour) === 0) {
        extruder = 'extruder';
        if (toolIndex > 0) {
            extruder += toolIndex;
        }
        state.pressureAdvanceCode = 'PRESSURE_ADVANCE EXTRUDER={current_extruder} ADVANCE=';
        return 'PRESSURE_ADVANCE EXTRUDER=${extruder} ADVANCE=';
    } else if ('reprapfirmware'.localeCompare(flavour) === 0) {
        state.pressureAdvanceCode = 'M572 D{current_extruder} S';
        return 'M572 D${toolIndex} S';
    } else if (!!flavour.match('marlin|marlin2')) {
        // Modern Prusa Pressure Advance
        if (!!printerModel.match(/XL\d?IS|MINIIS|MK4IS/)) {
            // Prusa doesn't seem to have the D parameter from RRF
            state.pressureAdvanceCode = 'M572 S';
            return 'M572 S';
        }
        // legacy marlin linear advance
        state.pressureAdvanceCode = 'M900 K';
        return 'M900 K';
    } else {
        throw "Sorry, your firmware type is not supported yet"
    }
}

function generateTestGCode(gcodeLines, calibrationGCode) {
    const startIndex = findObjectStart(gcodeLines);
    const endIndex = findObjectEnd(gcodeLines);
    const startLines = gcodeLines.slice(0, startIndex + 1);
    const endLines = gcodeLines.slice(endIndex);
    updateLastTemperatureCommand(startLines, state.calibrationParams.get('FILAMENT_TEMPERATURE'));
    const gcodeText = startLines.join('\n') + calibrationGCode + endLines.join('\n');
    return new Blob([gcodeText], {type: 'text/plain'});
} 

function saveTestGCode() {
    saveAs(state.gcodeBlob, state.gcodeFileName);
}

function loadPrusaSlicerSettings(gcodeLines) {
    const setting_regex = new RegExp(/^; ([a-z0-9_]+) = (.+)$/);
    const settings = {};
    // for every line:
    for (var i = 0; i < gcodeLines.length; i++) {
        var line = gcodeLines[i];
        var results = setting_regex.exec(line);
        if (results !== null) {
            settings[results[1]] = results[2];
        }
    }
    return settings;
}

function checkRequiredSettings(allValues) {
    const settingNodes = []
    hasAllSettings = true;
    foundSettings = new Map();
    requiredSettings.forEach((settingFunctions, key, map) => {
        parser = settingFunctions[0];
        formatter = settingFunctions[1];
        isRequired = settingFunctions[3];
        if (!(key in allValues)) {
            if (isRequired) {
                hasAllSettings = false;
                settingNodes.push(`<tr><td class="error">${key}</td><td>???</td></tr>`);
            } else {
                settingNodes.push(`<tr><td class="error">${key}</td><td></td></tr>`);
            }
        } else {
            const toolNumber = foundSettings.has('perimeter_extruder') ? foundSettings.get('perimeter_extruder') : null;
            const value = parser(allValues[key], toolNumber, key);
            foundSettings.set(key, value);
            settingNodes.push(`<tr><td>${key}</td><td>${formatter(value)}</td></tr>`);
        }
    });

    u('#gcode-details').html(settingNodes.join('\n')).first().hidden = false;

    if (!hasAllSettings) {
        throw("A required parameter could not be found in the gcode file");
    }

    return foundSettings;
}

function stripTypeCustom(lines) {
    // for some reason, if you leave this comment in the source, Prusa's GCode viewer wont open it.
    return lines.filter(line => line !== ";TYPE:Custom");
}

function findObjectStart(lines) {
    for (var i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === ";AFTER_LAYER_CHANGE") {
        return i;
        }
    }
    throw("Could not find start of gcode object");
}

function findObjectEnd(lines) {
    for (var i = lines.length - 1; i > 0; i--) {
        const line = lines[i];
        if (line === "; Filament-specific end gcode") {
        return i;
        }
    }
    throw("Could not find end of gcode object");
}

function updateLastTemperatureCommand(startGcodeLines, temp) {
    const tempRegex = /(M109 .*S)(\d{2,3})(.*)/;
    // looking for the LAST time that temp wait (M109) was used in start gcode
    // (so, eg, if other tools get shut off after it wont catch those)
    for (var i = startGcodeLines.length - 1; i > 0; i--) {
        const line = startGcodeLines[i];
        if (line.match(tempRegex)) {
            // replace temp in the existing line
            startGcodeLines[i] = line.replace(tempRegex, '$1' + temp + '$3');
            return;
        }
    }
    throw("Could not find temperature set in start gcode");
}

function extractGCode(file) {
    // TODO: if file name ends with '.bgcode' complain about binary gcode
    state.gcodeFileName = file.name;
    onFileNameSet();
    const reader = new FileReader();
    reader.onload = function(event) {
        processGcodeFile(event.target.result);
    };
    reader.readAsText(file);
}

function dropHandler(event) {
    if (event.dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s)
        [...event.dataTransfer.items].forEach((item, i) => {
            // If dropped items aren't files, reject them
            if (item.kind === "file") {
                extractGCode(item.getAsFile());
                return;
            }
        });
    } else {
        // Use DataTransfer interface to access the file(s)
        [...event.dataTransfer.files].forEach((file, i) => {
            console.log(`… file[${i}].name = ${file.name}`);
            extractGCode(file);
            return;
        });
    }
}

function writeToClipboard(text) {
    navigator.clipboard.writeText(text);
}

function generatePressureAdvanceConditional(paValue) {
    return `{if nozzle_diameter[current_extruder] == ${state.nozzleDiameter}}\n` +
            `${state.pressureAdvanceCode}${paValue}\n` +
            '{endif}\n';
}

/******************* 
      UX Wiring
 *******************/

// on drag over prevent default
u('body').handle('dragover', () => {});
// on drop, process gcode file
u('#drop-target').handle('drop', (event) => {
    u('#gcode-file-display').first().hidden = true;
    u('#gcode-results').first().hidden = true;
    u('#error-display').first().hidden = true;
    u('#prusa-slicer-details').first().hidden = true;
    u('#pressure-advance-tweaks-form').find('fieldset').first().disabled = true;
    u('#filament-gcode-form').find('fieldset').first().disabled = true;
    dropHandler(event);
});

// When the copy button is clocked, write text to clipboard
u('#copy-button').handle('click', () => {
    writeToClipboard(u('#pressure-advance-code-block').text());
});

// when the user enters a number into the filament pressure advance box, regenerate the code
u('#pressure-advance-input').handle('keyup', (e) => {
    paValue = parseFloat(e.target.value);
    
    if (isNaN(paValue) || !isFinite(paValue)) {
        u('#pressure-advance-input').attr('aria-invalid', true);
    } else {
        u('#pressure-advance-input').attr('aria-invalid', false);
        u('#pressure-advance-code-block').text(generatePressureAdvanceConditional(paValue));
    }
});

// save gcode when download button is clicked
u('#download-button').on('click', saveTestGCode);

// TODO: whenever anything in the tweaks form changes, re-generate the gcode
function validateNumberInput(input) {
    const val = input.value;
    paValue = parseFloat(val);
    if (isNaN(paValue) || !isFinite(paValue)) {
        // make the source of the problem red
        u(input).attr('aria-invalid', true);
        return false;
    } else {
        u(input).attr('aria-invalid', false);
        return true;
    }
}

advanceInputs = u('#ADVANCE_START, #ADVANCE_END, #ADVANCE_STEP');
function validateAllAdvanceInputs() {
    var allValid = true;
    advanceInputs.each((input) => {
        allValid = allValid && validateNumberInput(input);
    });
    return allValid;
};

advanceInputs.handle('keyup', () => {
    validateAllAdvanceInputs();
    prepareTestGcode();
});

validateAllAdvanceInputs(); // validate all inputs on startup

// if the custom radio option is not selected, don't enable its fields
u('input[name="ADVANCE"]').handle('change', (event) => {
    u('#custom-pressure-advance-fields').first().disabled = event.target.value !== 'custom';
    console.log(event.target.value);
    prepareTestGcode();
});

// when the user selects a file, extract its gcode
u('#browse-files-input').on('change', (event) => {
    extractGCode(event.target.files[0]);
});

// on startup, if the user last selected custom, enable custom fieldset
if (u('input[name="ADVANCE"]:checked').first().value === 'custom') {
    u('#custom-pressure-advance-fields').first().disabled = false;
}

function onFileNameSet() {
    u('#gcode-file-display').text(state.gcodeFileName).first().hidden = false;
}

// when a file has been successfully parsed show everything hidden
function onParsingSuccess() {
    u('#gcode-results').first().hidden = false;
    u('#pressure-advance-tweaks-form').find('fieldset').first().disabled = false;
    u('#filament-gcode-form').find('fieldset').first().disabled = false;
    // re-run the filament gcode generator
    u('#pressure-advance-input').trigger('keyup');
    u('#prusa-slicer-details').first().hidden = false;
    u('#download-button').first().disabled = false;
}

function onValidationsStart() {
    u('#download-button').first().disabled = true;
    u('#parameter-error-display').first().hidden = true;
}

function onValidationError(exMessage) {
    console.log('in onValidationError', exMessage);
    u('#parameter-error-display').html(exMessage);
    u('#parameter-error-display').first().hidden = false;
}

function onValidationSuccess() {
    u('#download-button').first().disabled = false;
    u('#parameter-error-display').first().hidden = true;
}

function onError(exMessage) {
    u('#error-display').text(exMessage)
    u('#error-display').first().hidden = false;
}

// when we read the config we will try to auto select Bowden as the extruder type for the mini:
function onGuessExtruderType(extruderType) {
    currentType = u('input[name="ADVANCE"]:checked').first().value;
    if (currentType === 'custom') {
        return;  // user says they know what they are doing
    }
    if (extruderType !== currentType) {
        u('input[name="ADVANCE"]').each(radio => {
            if (radio.value === extruderType) {
                radio.checked = true;
            }
        })
    }
}














