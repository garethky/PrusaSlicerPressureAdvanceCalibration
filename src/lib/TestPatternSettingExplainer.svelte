<script lang="ts">
    import Admonition from "./Admonition.svelte";
    import { SettingValue } from "./GcodeProcessor";
    import RequiredSettingValue from "./RequiredSettingValue.svelte";
    import type { ExplainedValue } from "./TestPatternConfiguration";
    import { ExplanationArray, ExplanationFanSpeed, ExplanationMaxOf, ExplanationPaGcode, ExplanationSumOf, ExplanationVolumetricFlow } from "./TestPatternSettingExplainer";

    export let setting: ExplainedValue<any>; 
</script>
<tr>
    <td>{setting.displayName}</td>
    <td>{@html setting.displayValue}</td>
    <td>
        {#if setting.explanation instanceof ExplanationMaxOf }
            Max of: 
            {#each setting.explanation.maxOf as val }
                {#if val === setting.explanation.selected }
                    <strong><RequiredSettingValue value={val} /></strong>
                {:else}
                    <RequiredSettingValue value={val} />
                {/if}
            {/each}
        {:else if setting.explanation instanceof ExplanationSumOf }
            Sum Of: 
            {#each setting.explanation.sumOf as val }
                <RequiredSettingValue value={val} />
            {/each}
        {:else if setting.explanation instanceof ExplanationPaGcode }
            Selected based on <RequiredSettingValue value={setting.explanation.gcodeFlavor} /> 
            and <RequiredSettingValue value={setting.explanation.printerModel} />
        {:else if setting.explanation instanceof ExplanationFanSpeed }
            Based on the <RequiredSettingValue value={setting.explanation.minFanSpeed} /> and 
            <RequiredSettingValue value={setting.explanation.fanOffLayers} />
        {:else if setting.explanation instanceof ExplanationArray}
            {#each setting.explanation.values as value }
                <code>{value}</code>
            {/each}
        {:else if setting.explanation instanceof ExplanationVolumetricFlow }
            <li>
                Selected the minimum, non zero, flow rate from: [
                {#each setting.explanation.flows as flow }
                    <RequiredSettingValue value={flow} />
                {/each}
                ] as the flow rate limit.
            </li>
            <li>
                The max print speed from: [
                {#each setting.explanation.speeds as speed }
                    <RequiredSettingValue value={speed} />
                {/each}
                ] as the requested speed.
            </li>
            <li>
                The maximum possible speed for the flow rate limit is: {setting.explanation.requestedFlow}, test speed is {setting.explanation.actualFlow}
            </li>
        {:else if setting.explanation instanceof SettingValue }
            <code>{setting.explanation.key}</code>
        {:else if typeof setting.explanation === 'string' }
            {setting.explanation}
        {:else}
            <Admonition type="warning" message="You still have some code to write!"/>
        {/if}
    </td>
</tr>