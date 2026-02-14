<script lang="ts">
    import type { SettingValue } from "./GcodeProcessor";
    export let value: SettingValue<any>;
</script>
<code>{value.key}</code>:{@html value.displayValue}
