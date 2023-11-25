// https://help.prusa3d.com/article/macros_1775
// Support [variable_1] and {variable[1]}
// nothing else is supported! No conditionals, functions etc.

export class Block {
    content: string = "";
    constructor(content: string) {
        this.content = content;
    }
}

export class ScriptBlock extends Block {
    variable: string;
    index: number| null = 0;
    constructor(content: string, variable: string, index: number) {
        super(content);
        this.variable = variable;
        this.index = index;
    }
}

export function evaluateGcodeTemplate(template: string, replacements: Map<string, string[]>): string[] {
    let lines = template.split('\\n');
    let outLines: string[] = [];
    lines.forEach(line => {
        let blocks = splitToBlocks(line)
        replaceVariables(blocks, replacements);
        outLines.push(joinTemplatedBlocks(blocks));
    });
    
    return outLines;
}

export function replaceVariables(blocks: Array<Block | ScriptBlock>, replacements: Map<string, string[]>) {
    blocks.forEach(block => {
        if (block instanceof ScriptBlock) {
            let replacement = replacements.get(block.variable);
            if (replacement) {
                if (block.index) {
                    if (block.index >= replacement.length) {
                        throw `Index variable ${block.variable}[${block.index}] was not fund, index too large.`
                    }
                    block.variable = replacement[block.index];
                } else {
                    block.variable = replacement[0];
                }
            } else {
                throw `Variable ${block.variable} not found!`;
            }
        }
    })
}

export function splitToBlocks(line: string): Array<Block | ScriptBlock> {
    let blocks: Array<Block | ScriptBlock> = [];

    let i: number = 0;
    while (i < line.length) {
        let nextIndex: number;
        let block: Block | ScriptBlock | false;
        [block, nextIndex] = nextBlock(line, i);
        i = nextIndex;
        if (block) {
            blocks.push(block);
        } else {
            break;
        }
    }

    return blocks;
}

// TODO: loop through blocks replacing blocks that have replacement values

// join blocks back together to verify they were parsed correctly
export function joinBlocks(blocks: Array<Block | ScriptBlock>): string {
    let out: Array<string> = [];
    blocks.forEach((block, i) => {
        out.push(block.content);
    });
    return out.join('');
}

export function joinTemplatedBlocks(blocks: Array<Block | ScriptBlock>): string {
    let out: Array<string> = [];
    blocks.forEach((block, i) => {
        if (block instanceof ScriptBlock) {
            out.push(block.variable);
        } else {
            out.push(block.content);
        }
        
    });
    return out.join('');
}

export function nextBlock(line: string, startIndex: number): [Block | ScriptBlock | false, number] {
    // if the first character is the start of a script block, this is a script block, else this is a static block
    let startChar = line.charAt(startIndex);
    if (startChar === '[') {
        return readLegacyScriptBlock(line, startIndex);
    } else if (startChar === '{') {
        return readScriptBlock(line, startIndex);
    } else {
        return readBlock(line, startIndex);
    }
}

export function readBlock(line: string, startIndex: number): [false | Block | ScriptBlock, number] {
    for (let i = startIndex; i < line.length; i++) {
        let nextChar = line.charAt(i);
        if (nextChar === '[' || nextChar === '{') {
            // break for start of script block
            console.log('block ended at', nextChar);
            return [new Block(line.substring(startIndex, i)), i];
        }
    }
    return [new Block(line.substring(startIndex)), line.length];
}

export function readLegacyScriptBlock(line: string, startIndex: number): [false | Block | ScriptBlock, number] {
    let endBlockIndex = line.indexOf(']', startIndex);
    if (endBlockIndex === -1) {
        throw "Illegal legacy template, opened block '[' without closing ']'";
    }
    let content = line.substring(startIndex, endBlockIndex + 1);
    let variable = content.substring(1, content.length - 1).trim();
    let index = 0;
    // empty square brackets -> no output
    if (variable.length === 0) {
        return [new Block(''), endBlockIndex + 1];
    }
    let terminalIndexRegex = /_(\d)$/;
    let indexMatch = variable.match(terminalIndexRegex);
    if (indexMatch !== null) {
        index = parseInt(indexMatch[1]);
        variable = variable.substring(0, variable.length - indexMatch[0].length);
    }
    return [new ScriptBlock(content, variable, index), endBlockIndex + 1];
}

export function readScriptBlock(line: string, startIndex: number): [false | Block | ScriptBlock, number] {
    // modern script block can contain strings that contain '}' but thats beyond the scope of what I think Klipper needs
    for (let i = startIndex; i < line.length; i++) {
        let char: string = line.charAt(i);
        if (char === '}') {
            // found block termination
            let content = line.substring(startIndex, i + 1);
            let variable = content.substring(1, content.length - 1).trim();
            let index = 0;
            let terminalIndexRegex = /\[(\d)\]$/;
            let indexMatch = variable.match(terminalIndexRegex);
            if (indexMatch !== null) {
                index = parseInt(indexMatch[1]) - 1;
                variable = variable.substring(0, variable.length - indexMatch[0].length);
            }
            return [new ScriptBlock(content, variable, index), i + 1];
        }
    }
    throw "Illegal template, opened block '{' without closing '}'";
}
