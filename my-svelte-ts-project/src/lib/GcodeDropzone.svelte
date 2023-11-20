<script lang="ts">
    import Admonition from "./Admonition.svelte";
    import {gcodeStore, SettingValue, GCodeProcessor, RequiredSlicerSettings } from "./GcodeProcessor";

    let uploadError: string | null = null;
    let uploadSuccess: string | null = null;
  
    function onDrop(dropEvent: DragEvent) {
        console.log(dropEvent);
        uploadError = null;
        uploadSuccess = null;

        if (!dropEvent?.dataTransfer) {
            return;
        }
        const transfer: DataTransfer = dropEvent?.dataTransfer
        const items: DataTransferItemList = transfer?.items;
        const files: Array<File> = [];
        if (items) {
            // Use DataTransferItemList interface to access the file(s)
            [...items].forEach((item, i) => {
                // If dropped items aren't files, reject them
                if (item.kind === "file") {
                    let file = item.getAsFile();
                    if (file) {
                        files.push(file);
                    }
                }
            });
        } else {
            [...transfer.files].forEach((file, i) => {
                files.push(file);
            });
        }

        if (files.length === 0) {
            uploadError = "No Files Found";
        }
        else if (files.length === 1) {
            gcodeStore.parseFile(files[0]);
        } else {
            uploadError = "Multiple files found, please only drop 1 file.";
        }
    }

    $: {

        if ($gcodeStore?.requiredSettings?.hasErrors === false) {
            uploadSuccess = "GCode file looks good!";
        }
    }
</script>

<div>
    <form>
        <fieldset>
            <div class="dropzone" on:dragover={(e) => {e.preventDefault();}} on:drop={onDrop} role="form">
                <input class="dropzone" type="file" name="browse"/>
                <div class="dropzone-prompt">
                    <strong>Click to Upload</strong> a <code>.gcode</code> file or drag and drop here.
                </div>
            </div>
        </fieldset>
    </form>
    
    
    <Admonition type="error" message={uploadError} />
    <Admonition type="success" message="{uploadSuccess}"/>
    <details open={$gcodeStore?.hasErrors} hidden={$gcodeStore == null}>
        <summary>Detected Prusa Slicer Settings</summary>
        <table class="">
            <thead>
                <th>Setting</th>
                <th>Value</th>
            </thead>
            <tbody>
                {#if $gcodeStore?.requiredSettings?.allSettings }
                    {#each $gcodeStore.requiredSettings.allSettings as setting }
                        <tr>
                            <td><code>{setting.key}</code></td>
                            <td>
                            {#if setting.errors.length }
                                {#each setting.errors as error}
                                    <Admonition type='error' message='{error}' />
                                {/each}
                            {:else}
                                {@html setting.displayValue}
                            {/if}
                            </td>
                        </tr>
                    {/each}
                {/if}
            </tbody>
        </table>
    </details>
    
</div>

<style>
    .dropzone {
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100px;
        border-style: dashed;
        border-width: 2px;
        border-radius: 10px;
        border-color: var(--pico-color-orange-550);
        margin-left: calc(var(--pico-block-spacing-horizontal) * 2);
        margin-right: calc(var(--pico-block-spacing-horizontal) * 2);
    }

    .dropzone-prompt {
        justify-content: center;
        text-align: center;
    }

    input[type=file].dropzone {
        position: absolute;
        padding: 0 0 0 0;
        margin: 0 0 0 0;
        z-index: 1;
        opacity: 0;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
    }
</style>