export interface LatencyTableColumn {
  key: string;
  header: string;
  align?: 'left' | 'right';
  width?: number;
}

export function printLatencyTable(
  title: string,
  columns: LatencyTableColumn[],
  rows: Record<string, string | number>[],
): void {
  const widths = columns.map((column) => {
    const values = rows.map((row) => String(row[column.key] ?? ''));
    const maxValue = values.reduce((max, value) => Math.max(max, value.length), 0);
    return column.width ?? Math.max(column.header.length, maxValue);
  });

  const header = columns
    .map((column, index) => {
      const width = widths[index]!;
      return column.align === 'right' ? column.header.padStart(width) : column.header.padEnd(width);
    })
    .join(' | ');

  const divider = widths.map((width) => '-'.repeat(width)).join('-+-');

  console.log(`\n${title}`);
  console.log(header);
  console.log(divider);

  for (const row of rows) {
    const line = columns
      .map((column, index) => {
        const width = widths[index]!;
        const value = String(row[column.key] ?? '');
        return column.align === 'right' ? value.padStart(width) : value.padEnd(width);
      })
      .join(' | ');
    console.log(line);
  }
}

export function formatMs(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `${Math.round(value)} ms`;
}

export function previewText(text: string, maxLength = 36): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function average(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
