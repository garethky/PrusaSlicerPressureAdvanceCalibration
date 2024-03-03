import { describe, it, expect } from 'vitest';
import { splitToBlocks, ScriptBlock, Block, joinBlocks, readLegacyScriptBlock, readScriptBlock, replaceVariables, evaluateGcodeTemplate } from './PrusaGcodeTemplateEvaluator';

describe('readLegacyScriptBlock tests', () => {
    it('legacy script block', () => {
        let line = "[foo]";
        let [block, index] = readLegacyScriptBlock(line, 0);
        expect(block instanceof ScriptBlock).toBe(true)
        expect((block as ScriptBlock).content).toBe(line);
        expect((block as ScriptBlock).variable).toBe('foo');
        expect((block as ScriptBlock).index).toBe(0);
    });
    it('legacy script block with index', () => {
        let line = "[foo_1]";
        let [block, index] = readLegacyScriptBlock(line, 0);
        expect(block instanceof ScriptBlock).toBe(true)
        expect((block as ScriptBlock).content).toBe('[foo_1]');
        expect((block as ScriptBlock).variable).toBe('foo');
        expect((block as ScriptBlock).index).toBe(1);
    });
});

describe('readScriptBlock tests', () => {
    it('script block', () => {
        let line = "{foo}";
        let [block, index] = readScriptBlock(line, 0);
        expect(block instanceof ScriptBlock).toBe(true)
        expect((block as ScriptBlock).content).toBe(line);
        expect((block as ScriptBlock).variable).toBe('foo');
        expect((block as ScriptBlock).index).toBe(0);
    });
    it('script block with index', () => {
        let line = "{foo[1]}";
        let [block, index] = readScriptBlock(line, 0);
        expect(block instanceof ScriptBlock).toBe(true)
        expect((block as ScriptBlock).content).toBe(line);
        expect((block as ScriptBlock).variable).toBe('foo');
        expect((block as ScriptBlock).index).toBe(0);
    });
});

describe('block parser tests', () => {
    it('non-script lines parse to 1 block', () => {
        let line = "th is is just some text";
        let blocks = splitToBlocks(line);
        expect(blocks.length).toBe(1);
        expect(blocks[0] instanceof Block).toBe(true)
    });
    it('single legacy block parses to 1 block', () => {
        let line = "[test]";
        let blocks = splitToBlocks(line);
        expect(blocks.length).toBe(1);
        expect(blocks[0] instanceof ScriptBlock).toBe(true);
    });
    it('single modern script block parses to 1 block', () => {
        let line = "{test}";
        let blocks = splitToBlocks(line);
        expect(blocks.length).toBe(1);
        expect(blocks[0] instanceof ScriptBlock).toBe(true);
    });
    it('Unclosed legacy script block throws exception', () => {
        let line = "[test";
        expect(() => splitToBlocks(line)).throws();
    });
    it('Unclosed modern script block throws exception', () => {
        let line = "{test";
        expect(() => splitToBlocks(line)).throws();
    });
    it('legacy block preceded by comment parses to 2 blocks', () => {
        let line = "foo [test]";
        let blocks = splitToBlocks(line);
        expect(blocks.length).toBe(2);
        expect(blocks[0] instanceof Block).toBe(true);
        expect(blocks[1] instanceof ScriptBlock).toBe(true);
        expect(joinBlocks(blocks)).eq(line);
    });
    it('modern script block preceded by comment parses to 2 blocks', () => {
        let line = "foo {test}";
        let blocks = splitToBlocks(line);
        expect(blocks.length).toBe(2);
        expect(blocks[0] instanceof Block).toBe(true);
        expect(blocks[1] instanceof ScriptBlock).toBe(true);
        expect(joinBlocks(blocks)).eq(line);
    });
    it('legacy block followed by comment parses to 2 blocks', () => {
        let line = "[test] foo";
        let blocks = splitToBlocks(line);
        expect(blocks.length).toBe(2);
        expect(blocks[0] instanceof ScriptBlock).toBe(true);
        expect(blocks[1] instanceof Block).toBe(true);
        expect(joinBlocks(blocks)).eq(line);
    });
    it('modern script block preceded by comment parses to 2 blocks', () => {
        let line = "{test} foo";
        let blocks = splitToBlocks(line);
        expect(blocks.length).toBe(2);
        expect(blocks[0] instanceof ScriptBlock).toBe(true);
        expect(blocks[1] instanceof Block).toBe(true);
        expect(joinBlocks(blocks)).eq(line);
    });
    it('complex script line', () => {
        let line = "This is a {test[0]} of the [script] parser";
        let blocks = splitToBlocks(line);
        expect(blocks.length).toBe(5);
        expect(blocks[0] instanceof Block).toBe(true);
        expect(blocks[1] instanceof ScriptBlock).toBe(true);
        expect(blocks[2] instanceof Block).toBe(true);
        expect(blocks[3] instanceof ScriptBlock).toBe(true);
        expect(blocks[4] instanceof Block).toBe(true);
        expect(joinBlocks(blocks)).eq(line);
    });
});

describe('replaceVariables tests', () => {
    it('replace single variable', () => {
        let block = new ScriptBlock('', 'foo', 0);
        let replacements = new Map([['foo', ['bar']]]);
        replaceVariables([block], replacements);
        expect(block.variable).toBe('bar');
    });
    it('replace indexed variable', () => {
        let block = new ScriptBlock('', 'foo', 0);
        let replacements = new Map([['foo', ['bar']]]);
        replaceVariables([block], replacements);
        expect(block.variable).toBe('bar');
    });
    it('missing replacement throws exception', () => {
        let block = new ScriptBlock('', 'foo', 0);
        let replacements = new Map();
        expect(() => replaceVariables([block], replacements)).throws();
    });
    it('missing replacement index exception', () => {
        let block = new ScriptBlock('', 'foo', 1);
        let replacements = new Map([['foo', ['bar']]]);
        expect(() => replaceVariables([block], replacements)).throws();
    });
    it('replace multiple variables', () => {
        let blocks = [
            new ScriptBlock('', 'foo', 0),
            new ScriptBlock('', 'bar', 0),
            new ScriptBlock('', 'baz', 0),
        ];
        let replacements = new Map([
            ['foo', ['value1']],
            ['bar', ['value2']],
            ['baz', ['value3']],
        ]);
        replaceVariables(blocks, replacements);
        expect(blocks[0].variable).toBe('value1');
        expect(blocks[1].variable).toBe('value2');
        expect(blocks[2].variable).toBe('value3');
    });
});

describe('evaluateGcodeTemplate tests', () => {
    it('test klipper start gcode example', () => {
        let startGcode = 'M104 S0 ; Stops PS/SS from sending temp waits separately\nM140 S0\n\nPRINT_WARMUP EXTRUDER_TEMP=[first_layer_temperature] BED_TEMP=[first_layer_bed_temperature]\nPRINT_START EXTRUDER_TEMP=[first_layer_temperature] BED_TEMP=[first_layer_bed_temperature] PRINT_START_X=[first_layer_print_min_0] PRINT_START_Y=[first_layer_print_min_1] PRINT_END_X=[first_layer_print_max_0] PRINT_END_Y=[first_layer_print_max_1]';
        let expected = 'M104 S0 ; Stops PS/SS from sending temp waits separately\nM140 S0\n\nPRINT_WARMUP EXTRUDER_TEMP=260 BED_TEMP=85\nPRINT_START EXTRUDER_TEMP=260 BED_TEMP=85 PRINT_START_X=0 PRINT_START_Y=1 PRINT_END_X=300 PRINT_END_Y=301';
        let replacements = new Map([
            ['first_layer_temperature', ['260']],
            ['first_layer_bed_temperature', ['85']],
            ['first_layer_print_min', ['0', '1']],
            ['first_layer_print_max', ['300', '301']],
        ]);
        let templated = evaluateGcodeTemplate(startGcode, replacements);
        expect(templated.length).toBe(1);
        expect(templated[0]).toBe(expected);
    });
});