<script lang="ts">
    import { TestPatternConfiguration, testPatternConfigStore } from "./TestPatternConfiguration";
    import { pressureAdvanceStore } from "./PressureAdvanceStore";
    import { RequiredSlicerSettings, gcodeStore } from "./GcodeProcessor";
    import Admonition from "./Admonition.svelte";
    import { generateTestPattern } from "./TestPatternGenerator";
    import FileSaver from "file-saver";
    import TestPatternSettingExplainer from "./TestPatternSettingExplainer.svelte";
  import { prepareStartGcode } from "./StartGcodePrep";

    let canDownload: boolean = false;
    let error: string | null = null;
    let filename: string = '';
    let settings: RequiredSlicerSettings | null = null;

    function downloadGcode() {
        if (!$testPatternConfigStore || !$gcodeStore) {
            throw "illegal state exception";
        }
        let file: Array<string> = [];
        let toolIndex: number = $gcodeStore.requiredSettings?.perimeter_extruder.toValue() as number;
        let temp: number = $testPatternConfigStore.filament_temperature.value
        prepareStartGcode($gcodeStore.startLines, temp, toolIndex);
        file.push(...$gcodeStore.startLines);
        file.push(generateTestPattern($testPatternConfigStore));
        file.push(...$gcodeStore?.endLines);
        let blob = new Blob([file.join('\n')], {type: 'text/plain'});
        FileSaver(blob, filename);
    }

    $: {
        canDownload = false;
        filename = '';
        if ($gcodeStore && $pressureAdvanceStore){
            const requiredSettings = $gcodeStore.requiredSettings;
            if (requiredSettings && $gcodeStore?.hasErrors == false) {
                settings = requiredSettings;
                try {
                    $testPatternConfigStore = new TestPatternConfiguration(requiredSettings, $pressureAdvanceStore);
                    canDownload = true;
                    filename = `PA-Test_${requiredSettings.printer_model.displayValue}_${requiredSettings.filament_settings_id.displayValue}_${$pressureAdvanceStore.start}_${$pressureAdvanceStore.end}.gcode`;
                }
                catch (ex) {
                    error = "Test pattern generation failed: " + ex;
                }
            }
        }
    }
</script>

{#if $testPatternConfigStore && settings }
<table>
    <thead>
        <tr>
            <th>Setting</th>
            <th>Value</th>
            <th>Explanation</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td colspan="3" class="alternate"><strong><strong>Filament</strong></strong></td>
        </tr>
        <!-- Printer -->
        <TestPatternSettingExplainer setting={$testPatternConfigStore.printer} />
        <!-- Pressure Advance -->
        <tr><td colspan="3"><h4>Pressure Advance</h4></td></tr>
        <TestPatternSettingExplainer setting={$testPatternConfigStore.advance_gcode_prefix} />
        <TestPatternSettingExplainer setting={$testPatternConfigStore.advance_lines} />
        <!-- Bed -->
        <tr><td colspan="3"><h4>Printer Bed</h4></td></tr>
        <TestPatternSettingExplainer setting={$testPatternConfigStore.bed_shape} />
        <TestPatternSettingExplainer setting={$testPatternConfigStore.bed_x} />
        <TestPatternSettingExplainer setting={$testPatternConfigStore.bed_y} />
        <!-- Filament-->
        <tr><td colspan="3"><h4>Filament</h4></td></tr>
        <TestPatternSettingExplainer setting={$testPatternConfigStore.filament} />
        <TestPatternSettingExplainer setting={$testPatternConfigStore.filament_diameter} />
        <TestPatternSettingExplainer setting={$testPatternConfigStore.filament_temperature} />
        <TestPatternSettingExplainer setting={$testPatternConfigStore.fan_speed} />
        <!-- Extrusion Params -->
        <tr><td colspan="3"><h4>Extrusion Settings</h4></td></tr>
        <TestPatternSettingExplainer setting={$testPatternConfigStore.nozzle_diameter} />
        <TestPatternSettingExplainer setting={$testPatternConfigStore.height_layer} />
        <TestPatternSettingExplainer setting={$testPatternConfigStore.extrusion_width} />
        <TestPatternSettingExplainer setting={$testPatternConfigStore.extrusion_multiplier} />
        <!-- Speeds-->
        <tr><td colspan="3"><h4>Speeds</h4></td></tr>
        <TestPatternSettingExplainer setting={$testPatternConfigStore.speed_print} />
        <TestPatternSettingExplainer setting={$testPatternConfigStore.speed_slow} />
        <TestPatternSettingExplainer setting={$testPatternConfigStore.speed_fast} />
        <TestPatternSettingExplainer setting={$testPatternConfigStore.speed_move} />
        <TestPatternSettingExplainer setting={$testPatternConfigStore.speed_move_z} />
        <!-- Accelerations -->
        <tr><td colspan="3"><h4>Accelerations</h4></td></tr>
        <TestPatternSettingExplainer setting={$testPatternConfigStore.printAcceleration} />
        <TestPatternSettingExplainer setting={$testPatternConfigStore.travelAcceleration} />
        <TestPatternSettingExplainer setting={$testPatternConfigStore.testAcceleration} />
        <!-- Retrations-->
        <tr><td colspan="3"><h4>Retraction</h4></td></tr>
        <TestPatternSettingExplainer setting={$testPatternConfigStore.retract_dist} />
        <TestPatternSettingExplainer setting={$testPatternConfigStore.retract_speed} />
        <TestPatternSettingExplainer setting={$testPatternConfigStore.deretract_dist} />
        <TestPatternSettingExplainer setting={$testPatternConfigStore.deretract_speed} />
        <TestPatternSettingExplainer setting={$testPatternConfigStore.zHopHeight} />
    </tbody>
    
</table>
{/if}

<Admonition type="error" message={error}/>
<button type="button" disabled={!canDownload} on:click={downloadGcode}>💾 Download</button> {filename}