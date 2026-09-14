export function joinSection(header: string, statements: string[]): string {
  if (statements.length === 0) {
    return `-- ${header}\n`;
  }

  return `-- ${header}\n\n${statements.join('\n\n')}\n`;
}

export function formatCreateTable(
  tableName: string,
  blocks: string[][],
  options?: { partitionBy?: string },
): string {
  const renderedBlocks = blocks.map((lines, blockIndex) => {
    const isLastBlock = blockIndex === blocks.length - 1;
    const renderedLines = lines.map((line, lineIndex) => {
      const prefix = '  ';
      if (line.startsWith('--')) {
        return `${prefix}${line}`;
      }

      const needsComma = lineIndex === 0 && !isLastBlock;
      return `${prefix}${line}${needsComma ? ',' : ''}`;
    });

    return renderedLines.join('\n');
  });

  const partitionSuffix = options?.partitionBy ? ` ${options.partitionBy}` : '';
  return `CREATE TABLE ${tableName} (\n${renderedBlocks.join('\n')}\n)${partitionSuffix};`;
}
