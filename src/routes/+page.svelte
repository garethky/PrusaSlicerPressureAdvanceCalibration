<script lang="ts">
    import FilamentGcodeGenerator from '$lib/FilamentGcodeGenerator.svelte';
    import GcodeDropzone from '$lib/GcodeDropzone.svelte';
    import PressureAdvancePicker from '$lib/PressureAdvancePicker.svelte';
    import TestPatternGenerator from '$lib/TestPatternGenerator.svelte';
</script>
  
  <h1>Prusa Slicer Pressure Advance Calibration</h1>
  <article>
      <hgroup>
          <header>
              <h2>1. Get the STL</h2>
          </header>
      </hgroup>
      <p><a href="https://www.printables.com/model/641490">Download the test model</a></p>
  </article>
  <article>
      <h2>2. Slice & Export</h2>
      <ol>
          <li>Import it into Prusa Slicer and place in the middle of the bed.</li>
          <li>Slice this model with your preferred slicer settings
              <ul>
                  <li>Select the filament preset that you want to tune</li>
                  <li>Use the printing preset that you want to tune for</li>
                  <li>If using a multi-tool printer (XL) select the tool that has the filament in it</li>
              </ul>
          </li>
      </ol>
  </article>
  <article>
      <header>
          <h2>3. Generate Test Pattern</h2>
          <p>We will use your exported <code>.gcode</code> to find your printers start/end gcode and the slicers settings</p>
      </header>
      <section class="drop-target">
          <GcodeDropzone></GcodeDropzone>
      </section>
      <PressureAdvancePicker/>
      <TestPatternGenerator/>
  </article>
  
  <article>
      <header>
          <hgroup>
              <h2>4. Print It</h2>
              <p>Print the GCode on your printer.</p>
          </hgroup>
      </header>
      <p>There is no easy way to send raw GCode to a Prusa printer right now, so put it on the USB stick.</p>
      <p>Follow <a href="https://help.prusa3d.com/article/linear-advance_2252">this guide</a> to find the best Pressure Advance Value. The guide is older but it has good pictures and information on what to look for.</p>
  </article>
  
  <article>
      <header>
          <hgroup>
              <h2>5. Update Filament GCode</h2>
              <p>Fill in the best value here and copy the code to your filament's starting GCode</p>
          </hgroup>
      </header>
      <FilamentGcodeGenerator/>
  </article>
  
  <footer>
      <section>
          <h3>License</h3>
          <ul>
              <li><a href="https://github.com/garethky/PrusaSlicerPressureAdvanceCalibration">Get the source on GitHub</a></li>
              <li><a href="https://github.com/garethky/PrusaSlicerPressureAdvanceCalibration/tree/mainline?tab=GPL-3.0-1-ov-file#readme">GPL-3.0 License</a></li>
          </ul>
          <h3>Credits</h3>
          <p>This is based on the original <a href="https://marlinfw.org/tools/lin_advance/k-factor.html">Marlin K-factor Calibration Pattern</a> by Sineos. Many thanks and sorry for taking a hacksaw to your work.</p>          
      </section>
  </footer>
  
  <style>
  </style>
  
