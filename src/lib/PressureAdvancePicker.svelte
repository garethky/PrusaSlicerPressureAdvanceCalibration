<script lang="ts">
    import NumberInputBox from './NumberInput.svelte';
    import { NumericField } from './NumericField.js';
    import { pressureAdvanceStore } from './PressureAdvanceStore';
  import Admonition from './Admonition.svelte';

    let start = new NumericField(0.025, 0, 999, 3);
    let end = new NumericField(0.1, 0, 999, 3);
    let isFormValid = false;
    
    const paSettings = pressureAdvanceStore;

    $: {
        if ($start.isValid && $end.isValid) {
            try {
                paSettings.setRange($start.numericValue, $end.numericValue);
                isFormValid = true;
            } catch (ex) {
                console.error(ex);
                isFormValid = false;
            }
        }
    }
</script>

<h4>Pressure Advance Test Range</h4>

<div class="row">
    <div class="col-lg-1 col-md-2 col-sm-3 col-xs-3">
        <form>
            <fieldset>
                <NumberInputBox size={5} name="start" label="Test from:" field={start}/>
                <NumberInputBox size={5} name="end" label="To:" field={end}/>
            </fieldset>
        </form>
    </div>
    <div class="col-lg-11 col-md-10 col-sm-9 col-xs-9">
        {#if $start.isValid && $end.isValid && isFormValid }
            <span>Test from <code>{$paSettings.start}</code> to <code>{$paSettings.end}</code> in steps of <code>{$paSettings.step}</code>.</span>
            <br/>
            <span>Prints <code>{$paSettings.lines.length}</code> test lines:</span>
            {#each $paSettings.lines as $value, i}
                {#if i > 0},{/if}
                <code>{$value}</code>
            {/each}
        {:else}
            <Admonition type="error" message="Check from and to values"></Admonition>
        {/if}
    </div>
</div>

