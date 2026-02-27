import { useMemo } from 'react';

interface CsvViewerProps {
  content: string;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current);
        current = '';
      } else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        row.push(current);
        current = '';
        if (row.some(c => c.trim())) rows.push(row);
        row = [];
        if (ch === '\r') i++;
      } else {
        current += ch;
      }
    }
  }
  // Last row
  if (current || row.length) {
    row.push(current);
    if (row.some(c => c.trim())) rows.push(row);
  }
  return rows;
}

export function CsvViewer({ content }: CsvViewerProps) {
  const rows = useMemo(() => parseCsv(content), [content]);

  if (rows.length === 0) {
    return <div className="csv-empty">No data</div>;
  }

  const header = rows[0];
  const body = rows.slice(1);

  return (
    <div className="csv-viewer">
      <table className="csv-table">
        <thead>
          <tr>
            <th className="csv-row-num">#</th>
            {header.map((cell, i) => (
              <th key={i}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri}>
              <td className="csv-row-num">{ri + 1}</td>
              {row.map((cell, ci) => (
                <td key={ci}>{cell}</td>
              ))}
              {/* Pad short rows */}
              {row.length < header.length &&
                Array.from({ length: header.length - row.length }, (_, k) => (
                  <td key={`pad-${k}`} />
                ))
              }
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
