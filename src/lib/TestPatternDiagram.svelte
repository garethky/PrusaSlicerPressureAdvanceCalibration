<script lang="ts">
    import { pressureAdvanceStore } from "./PressureAdvanceStore";
    import { testPatternConfigStore } from "./TestPatternConfiguration";
    import { getTickLength, TickLength } from "./PressureAdvanceModel";

    function gcodeForValue(paValue: number): string {
        if (!$testPatternConfigStore) return '';
        const prefix = $testPatternConfigStore.advance_gcode_prefix.value.slicerTemplate;
        const nozzle = $testPatternConfigStore.nozzle_diameter.value;
        return `{if nozzle_diameter[filament_extruder_id]==${nozzle}}\n    ${prefix}${paValue} ; Set Pressure Advance to ${paValue}\n{endif}`;
    }

    function copyGcode(paValue: number) {
        navigator.clipboard.writeText(gcodeForValue(paValue));
    }
</script>

{#if $pressureAdvanceStore.lines.length > 0}
    {@const lines = $pressureAdvanceStore.lines}
    <div class="pattern-diagram">
        <div class="origin-label">▲ Back of print</div>
        <table class="pattern-table">
            <thead>
                <tr>
                    <th class="col-row">#</th>
                    <th class="col-pattern">Test Line Pattern</th>
                    <th class="col-tick"></th>
                    <th class="col-pa">PA Value</th>
                    <th class="col-copy"></th>
                </tr>
            </thead>
            <tbody>
                {#each lines as _, j}
                    {@const i = lines.length - 1 - j}
                    {@const tickLength = getTickLength(i)}
                    <tr class:highlighted={tickLength > TickLength.SHORT}>
                        <td class="col-row">{i + 1}</td>
                        <td class="col-pattern">
                            <div class="line-visual">
                                <div class="segment slow"></div>
                                <div class="segment fast"></div>
                                <div class="segment slow"></div>
                            </div>
                        </td>
                        <td class="col-tick">
                            <div class="line-visual">
                                <div class="segment tick" class:tick-short={tickLength === TickLength.SHORT} class:tick-medium={tickLength === TickLength.MEDIUM} class:tick-long={tickLength === TickLength.LONG}></div>
                                <div class="spacer" class:spacer-short={tickLength === TickLength.SHORT} class:spacer-medium={tickLength === TickLength.MEDIUM} class:spacer-long={tickLength === TickLength.LONG}></div>
                            </div>
                        </td>
                        <td class="col-pa"><code>{lines[i]}</code></td>
                        <td class="col-copy">
                            <button class="copy-btn outline secondary" title="Copy gcode for PA {lines[i]}" disabled={!$testPatternConfigStore} on:click={() => copyGcode(lines[i])}>📋&nbsp;Copy&nbsp;PA&nbsp;Gcode</button>
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
        <div class="origin-label">▼ Front of print</div>
    </div>
{/if}

<style>
    .pattern-diagram {
        margin: 1em 0;
        overflow-x: auto;
    }

    .pattern-table {
        border-collapse: collapse;
        width: 100%;
        max-width: 600px;
        font-size: 0.9em;
    }

    .pattern-table th,
    .pattern-table td {
        padding: 0.25em 0;
        text-align: center;
    }

    .col-row {
        width: 3em;
        padding-right: 0.5em !important;
        color: var(--pico-muted-color, #666);
    }

    .col-pattern {
        border-left: 1px solid var(--pico-muted-color, #666);
        border-right: 1px solid var(--pico-muted-color, #666);
    }

    .col-tick {
        width: 15%;
    }

    .col-pa {
        width: 6em;
        padding-left: 0.5em !important;
        font-variant-numeric: tabular-nums;
    }

    .col-copy {
        width: 3em;
        padding: 0 !important;
    }

    .copy-btn {
        padding: 0.15em 0.4em;
        /*width: auto;*/
    }

    .line-visual {
        display: flex;
        align-items: center;
        height: 4px;
        gap: 0;
    }

    .segment {
        height: 4px;
    }

    .segment.slow {
        flex: 1;
        background-color: var(--pico-primary, #1095c1);
        opacity: 0.5;
    }

    .segment.fast {
        flex: 4;
        background-color: var(--pico-primary, #1095c1);
    }

    tr.highlighted {
        background-color: var(--pico-card-background-color, rgba(0,0,0,0.03));
    }

    tr.highlighted .col-pa code {
        font-weight: bold;
    }

    .segment.tick {
        background-color: var(--pico-primary, #1095c1);
        opacity: 0.3;
    }
    .tick-short { flex: 4; }
    .tick-medium { flex: 8; }
    .tick-long { flex: 12; }

    .spacer {
        height: 4px;
    }
    .spacer-short { flex: 8; }
    .spacer-medium { flex: 4; }
    .spacer-long { display: none; }

    .origin-label {
        text-align: center;
        max-width: 600px;
        font-size: 0.8em;
        color: var(--pico-muted-color, #666);
        padding: 0.25em 0;
    }
</style>
