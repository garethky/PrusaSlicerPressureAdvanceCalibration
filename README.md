# PrusaSlicerPressureAdvanceCalibration
An javascript tool that modified PrusaSlicer GCode to be a pressure advance test pattern.

TK: [Public Link To Tool...]()

## Status : Alpha
USe at your own risk. No warranty is implied or given. I'm trying really hard NOT to crash your printer and NOT to make assumptions about it, but I'm not claiming this is perfect or even well tested yet.

# FAQ
Frequently Asked/Answered Questions

## How Does It Work?

When you slice the model you are exporting all of the settings from Prusa Slicer, as well as your printers start and end GCode. The web tool snips out the sliced model and inserts the GCode for a Pressure Advance tuning run based on your printers settings. It knows what your expected speeds and accelerations are, as well as the nozzle size, temperatures and everything else you set up in Prusa Slicer. Its looking at 33 different settings so far. It uses all of this to pick good configuration options for the pressure advance test generation.

The test gcode is generated and spliced into the original gcode file and then you download it.

## What about the Marlin Linear Advance Test?

That test generates startup GCode for your printer. Since it was never designed to work correctly with your printer, it wont correctly perform bed leveling, purging/priming or other tasks that make your printer safe. This went for annoying on the MK3 to dangerous on the XL.

This version uses the Marlin Linear Advance test to generate the printed test lines. Everything else comes from your slicer settings and slicer generated gcode.

### The Marlin tool had a lot of options, where did they go? I want option x back, can you please add it?
The original tool was great but it required you to be an absolute wizard to use it. This tool is pointed squarely at muggles. I'm only a wizard if I've had my coffee and spent time with the printer & filament configs. And that basically means I never used the original tool. Which is a shame, a properly tuned printer prints better. So I want to be able to use this tool when I haven't had my coffee and haven't used my Prusa Mini in 6 months.

Every option makes me need more coffee for wizard powers 🧙‍♂️, so the ideal number of options is zero. For every option I asked myself these questions:

* Is it something I cannot get from the slicer?
* Is it something that the majority or people will use every time?

The ony thing that absolutely fit that description is the Pressure Advance testing range.

If you think the majority of people need to configure something every time they use the tool and it cant be deduced from the slicer let me know.

## How does it tell where the test object is in the GCode?

The comment `;AFTER_LAYER_CHANGE` in the printers gcode is used as the start of the object. By default this is a comment that notes the layer z. If you have custom code here, put the comment at the end of the block.

The comment `; Filament-specific end gcode` marks the spot where the object has finished. This is found in the Filament specific gcode.

Both of these comments are defaults in Prusa slicer and should be there, unless you removed them.

## Do I need a specific test model to slice?

You don't, but using the suggested model will give you an approximate print time and give you a nice preview on the LCD so you can know what this print is later.

## I found a problem!

Thanks for taking the time, please open an issue on github: 