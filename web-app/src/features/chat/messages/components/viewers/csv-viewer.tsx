import React from "react";
import Papa from "papaparse";

export const CsvViewer: React.FC<{ content: string }> = ({ content }) => {
  const parseResult = Papa.parse(content, {
    header: false,
    skipEmptyLines: true,
    delimiter: ",",
    quoteChar: '"',
    escapeChar: '"',
  });

  const rows = parseResult.data as string[][];
  const headerRow = rows[0];
  const bodyRows = rows.slice(1);

  // Find the maximum number of columns
  const maxColumns = Math.max(
    headerRow?.length || 0,
    ...bodyRows.map((row) => row.length)
  );

  // Pad header cells if needed
  const headerCells = [...(headerRow || [])];
  while (headerCells.length < maxColumns) {
    headerCells.push("");
  }

  return (
    <div className="h-full w-full overflow-auto whitespace-nowrap">
      <table className="min-w-full table-fixed border-collapse">
        <thead>
          <tr className="bg-secondary font-semibold">
            {headerCells.map((cell, i) => (
              <td
                key={i}
                className="px-4 py-2 border overflow-hidden text-ellipsis"
              >
                {cell.trim()}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, i) => {
            // Pad row cells with empty strings if needed
            const cells = [...row];
            while (cells.length < maxColumns) {
              cells.push("");
            }
            return (
              <tr key={i} className="border-t">
                {cells.map((cell, j) => (
                  <td
                    key={j}
                    className="px-4 py-2 border overflow-hidden text-ellipsis"
                  >
                    {cell.trim()}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
