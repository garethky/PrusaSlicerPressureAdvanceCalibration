
<script lang="ts">
    export let type: 'success' | 'warning' | 'error' = 'success';
    export let message: string | null = null;
</script>

{#if message }
    <div class="alert alert-{type}" role="alert">{message}</div>
{/if}

