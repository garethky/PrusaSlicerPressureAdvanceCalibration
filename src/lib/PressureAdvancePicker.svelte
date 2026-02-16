<script lang="ts">
    import NumberInputBox from './NumberInput.svelte';
    import { NumericField } from './NumericField.js';
    import { pressureAdvanceStore } from './PressureAdvanceStore';
  import Admonition from './Admonition.svelte';
  import TestPatternDiagram from './TestPatternDiagram.svelte';
  import { printNumbersStore } from './PrintNumbersStore';

    let start = new NumericField(0.025, 0, 999, 3);
    let end = new NumericField(0.1, 0, 999, 3);
    let isFormValid: boolean = false;
    
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
    <div class="col-lg-2 col-md-2 col-sm-3 col-xs-3">
        <form>
            <fieldset>
                <NumberInputBox size={5} name="start" label="Test from:" field={start}/>
                <NumberInputBox size={5} name="end" label="To:" field={end}/>
                <input type="checkbox" bind:checked={$printNumbersStore} /> Print PA numbers
            </fieldset>
        </form>
    </div>
    <div class="col-lg-10 col-md-10 col-sm-9 col-xs-9">
        {#if $start.isValid && $end.isValid && isFormValid }
            <TestPatternDiagram />
        {:else}
            <Admonition type="error" message="Check from and to values for errors"></Admonition>
        {/if}
    </div>
</div>
