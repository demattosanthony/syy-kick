import { useCallback } from "react";

interface UseCsvActionsOptions {
  filename?: string;
}

export function useCsvActions(options: UseCsvActionsOptions = {}) {
  const { filename = "results" } = options;

  // Helper function to parse CSV line respecting quotes - same as in CsvViewer
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Handle escaped quotes
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const downloadCsv = useCallback(
    (content: string) => {
      const blob = new Blob([content], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [filename]
  );

  const previewCsv = useCallback(
    (content: string, title: string = "CSV Results") => {
      const rows = content.split("\n") || [];
      const headerRow = rows[0];
      const bodyRows = rows.slice(1);

      // Parse header and body using the parsing function
      const headerCells = headerRow ? parseCSVLine(headerRow) : [];
      const parsedBodyRows = bodyRows.map((row) => parseCSVLine(row));

      // Find the maximum number of columns
      const maxColumns = Math.max(
        headerCells.length,
        ...parsedBodyRows.map((row) => row.length)
      );

      // Pad header cells if needed
      while (headerCells.length < maxColumns) {
        headerCells.push("");
      }

      const newWindow = window.open("", "_blank");
      if (newWindow) {
        newWindow.document.write(`
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { font-family: sans-serif; margin: 20px; }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            <table>
              <thead>
                <tr>
                  ${headerCells
                    .map((cell) => `<th>${cell.trim()}</th>`)
                    .join("")}
                </tr>
              </thead>
              <tbody>
                ${parsedBodyRows
                  .map((row) => {
                    // Pad row cells with empty strings if needed
                    const cells = [...row];
                    while (cells.length < maxColumns) {
                      cells.push("");
                    }
                    return `
                    <tr>
                      ${cells.map((cell) => `<td>${cell.trim()}</td>`).join("")}
                    </tr>
                  `;
                  })
                  .join("")}
              </tbody>
            </table>
          </body>
        </html>
      `);
      }
    },
    []
  );

  return { downloadCsv, previewCsv };
}
