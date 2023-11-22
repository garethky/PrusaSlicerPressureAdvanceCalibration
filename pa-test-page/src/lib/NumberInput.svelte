<script lang="ts">
    import type { NumericField } from "./NumericField";

    // field supplied by parent component
    export let field: NumericField;
    export let name: string;
    export let label: string;
    export let size: number = 3;

    function onKeyDown(event: KeyboardEvent) {
        // if the value is not a real number this cannot work
        if (!field.isNumeric) {
            return;
        }
        
        if (event.key === 'ArrowUp') {
            field.increment(0.001);
            field.value = field.value;
        } else if (event.key === 'ArrowDown') {
            field.increment(-0.001);
            field.value = field.value;
        }
    }
</script>

<label for="{name}">{label}</label>
<input type="text" name={name} size={size} maxlength={5} bind:value={field.value} on:keydown={onKeyDown} aria-invalid={!field.isValid || null}/>
{field.errors}
