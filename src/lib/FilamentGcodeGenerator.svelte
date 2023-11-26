<script lang="ts">
    import { testPatternConfigStore } from "./TestPatternConfiguration";
    import { NumericField } from "./NumericField";
    import NumberInput from "./NumberInput.svelte";

    let paField = new NumericField(0.05, 0.0, 999, 3);
    let isFormDisabled = true;
    let nozzleDiameter: number | null = null;
    let pressureAdvanceGCode: string | null = null;
    let code: string = "";

    function templateCode() {
        code = `{if nozzle_diameter[filament_extruder_id]==${nozzleDiameter}}\n` +
        `    ${pressureAdvanceGCode}${paField.numericValue} ; Set Pressure Advance to ${paField.numericValue}\n` +
        `{endif}`;
    }

    function copyToClipboard() {
        navigator.clipboard.writeText(code);
    }

    $: {
        if (paField.isValid) {
            templateCode();
        }
    }

    $: {
        if ($testPatternConfigStore) {
            pressureAdvanceGCode = $testPatternConfigStore.advance_gcode_prefix.value.slicerTemplate;
            nozzleDiameter = $testPatternConfigStore?.nozzle_diameter.value;
            
        }
        isFormDisabled = pressureAdvanceGCode === null || nozzleDiameter === null;
        if (isFormDisabled) {
            code = "Upload a Gcode file build the template...";
        } else {
            templateCode();
        }
        
    }
</script>

<form id="filament-gcode-form">
    <fieldset disabled={isFormDisabled}>
        <label for="direct-drive">
            <div class="grid">
                <div>
                    <NumberInput bind:field={paField} label="Best Pressure Advance" name="pa-filament"/>
                </div>
                <div></div>
            </div>
        </label>
        <div class="grid">
            <div>
                <pre><code>
{code}
                </code></pre>
            </div>
            <div>
                <button type="button" id="copy-button" on:click={copyToClipboard} disabled={!paField.isValid}>Copy to 📋</button>
            </div>
        </div>
    </fieldset>
</form>