<script lang="ts">
    import { testPatternConfigStore } from "./TestPatternConfiguration";
    import { NumericField } from "./NumericField";
    import NumberInput from "./NumberInput.svelte";

    let paField = new NumericField(0.05, 0.0, 999, 3);
    let isFormDisabled = true;
    let nozzleDiameter: number | null = null;
    let pressureAdvanceGCode: string | null = null;

    $: {
        if ($testPatternConfigStore) {
            pressureAdvanceGCode = $testPatternConfigStore.advance_gcode_prefix.value.slicerTemplate;
            nozzleDiameter = $testPatternConfigStore?.nozzle_diameter.value;
        }
        isFormDisabled = pressureAdvanceGCode === null || nozzleDiameter === null;
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
{#if isFormDisabled}
Upload a Gcode file to see code...
{:else}
&#123;if nozzle_diameter[filament_extruder_id]=={nozzleDiameter}&#125;
{pressureAdvanceGCode}{paField.numericValue} ; Set Pressure Advance to {paField.numericValue}
&#123;endif&#125;
{/if}
                </code></pre>
            </div>
            <div>
                <button id="copy-button" disabled={!paField.isValid}>Copy to 📋</button>
            </div>
        </div>
    </fieldset>
</form>