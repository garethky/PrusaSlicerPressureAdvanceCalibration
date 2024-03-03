# PrusaSlicerPressureAdvanceCalibration
A web tool that modifies PrusaSlicer GCode to add a pressure advance test pattern.

[Go here to use the tool](https://garethky.github.io/PrusaSlicerPressureAdvanceCalibration/)

## Status : Alpha
Use at your own risk. No warranty is implied or given. I'm trying really hard NOT to crash your printer but this has not been widely tested yet.

# FAQ
Frequently Asked/Answered Questions

## How Does It Work?

When you slice the model you are exporting all of the settings from Prusa Slicer, as well as your printers start and end GCode, into the .gcode file. This tool snips out the sliced model and inserts the GCode for a Pressure Advance tuning pattern based on your printers settings. It knows what your expected speeds and accelerations are, as well as the nozzle size, temperatures and everything else you set up in Prusa Slicer. Its looking at 33 different settings so far. It uses all of this to pick good configuration options for the pressure advance test generation.

The test gcode is generated and spliced into the original gcode file and then you download it and print it.

A mini-tool is provided to generate the conditional GCode statements to go back into the filament config in the slicer.

## I found a problem!

Thanks for taking the time to try this out! Please open an issue here on github.

## Have you seen the Marlin K-factor Calibration Pattern?
The Marlin K-factor Calibration Pattern can be found [here](https://marlinfw.org/tools/lin_advance/k-factor.html). This tool started with some of the GCode generation tooling from that work.

However, that test generates startup GCode for your printer. Since it was never designed to work correctly with your printer, it might not correctly perform tasks like bed heating, leveling, nozzle wiping purging etc. that make your printer safe and reliable. This is especially true if you have a complex printer like the Prusa XL or a printer that runs something other than Marlin (e.g. Klipper).

The goal of this tool is to keep what is good about Marlin K-factor Calibration Pattern while leaving start/end gcode up to you and the slicer.

### The Marlin tool had a lot of options, where did they go? I want option x back, can you please add it?
The original tool was great but it required you to be an absolute wizard to use it. This tool is pointed squarely at muggles. I'm only a wizard if I've had my coffee and spent time with the printer & filament configs. And that basically means I never used the original tool. This, I feel, is a shame. A properly tuned printer prints better. So I want to be able to use this tool when I haven't had my coffee and haven't used my Prusa Mini in 6 months.

Every option makes me need more coffee for wizard powers 🧙‍♂️, so the ideal number of options is zero. For every option I asked myself these questions:

* Is it something I cannot get from the slicer?
* Is it something that the majority or people will use every time?

The only thing that absolutely fit that description is the Pressure Advance testing range.

If you think the majority of people need to configure something every time they use the tool and it cant be worked out from the slicer config let me know.

## How does it tell where the test object is in the GCode?

The comment `;LAYER_CHANGE` in the gcode is used as the start of the object. This comment is emitted by Prusa Slicer. Alternately you can include the comment `;START_GCODE_END` at the every end of the 'Start G-code' block and that will be used instead.

The comment `; Filament-specific end gcode` marks the spot where the object has finished. This is found in the Filament specific gcode. This is the default in Prusa slicer and should be there, unless you removed it.

## Do I need a specific test model to slice?

You don't, but using the [suggested model](https://www.printables.com/model/641490) will give you an approximate print time and give you a nice preview on the LCD so you can know what this print is later.