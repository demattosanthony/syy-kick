import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";

interface SheetData {
  name: string;
  data: (string | number | null)[][];
}

interface MultiSheetViewerProps {
  excelUrl: string;
}

const MultiSheetViewer: React.FC<MultiSheetViewerProps> = ({ excelUrl }) => {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExcelFile = async () => {
      try {
        const response = await fetch(excelUrl);
        if (!response.ok) {
          throw new Error("Failed to fetch the Excel file");
        }
        const arrayBuffer = await response.arrayBuffer();

        const workbook: XLSX.WorkBook = XLSX.read(new Uint8Array(arrayBuffer), {
          type: "array",
        });
        const sheetData: SheetData[] = workbook.SheetNames.map(
          (name: string) => ({
            name,
            data: XLSX.utils.sheet_to_json<(string | number | null)[]>(
              workbook.Sheets[name],
              { header: 1 }
            ),
          })
        );

        setSheets(sheetData);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
        setSheets([]);
      }
    };

    if (excelUrl) {
      fetchExcelFile();
    }
  }, [excelUrl]);

  return (
    <div className="h-full w-full flex flex-col bg-card text-card-foreground rounded-lg shadow-sm border border-border overflow-hidden max-w-[calc(100vw-42rem)]">
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 border-b border-destructive/20">
          Error: {error}
        </div>
      )}

      {sheets.length > 0 ? (
        <div className="flex flex-col h-full">
          {/* Sheet tabs with dark mode support */}
          <div className="flex space-x-1 p-2 bg-muted/50 border-b border-border overflow-x-auto">
            {sheets.map((sheet, index) => (
              <Button
                key={index}
                onClick={() => setActiveSheet(index)}
                className={`px-4 py-2 rounded-md font-medium text-sm transition-colors whitespace-nowrap
                ${activeSheet === index ? "shadow-sm" : "hover:bg-muted/70"}`}
                variant={activeSheet === index ? "default" : "ghost"}
                size="sm"
              >
                {sheet.name}
              </Button>
            ))}
          </div>

          {/* Spreadsheet container with dark mode support */}
          <div className="flex-1 overflow-auto">
            <div className="min-w-full inline-block">
              <table className="w-full border-collapse">
                <tbody>
                  {sheets[activeSheet].data.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className={`
                      ${
                        rowIndex === 0
                          ? "bg-muted/50 top-0 z-10"
                          : "hover:bg-muted/30"
                      }
                      transition-colors
                    `}
                    >
                      {(row || []).map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className={`
                          border-b border-r border-border p-2.5 text-sm
                          ${rowIndex === 0 ? "font-semibold" : ""}
                          ${
                            typeof cell === "number"
                              ? "text-right"
                              : "text-left"
                          }
                          min-w-[120px] max-w-[300px] truncate
                        `}
                          title={cell?.toString() || ""}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        !error && (
          <div className="flex items-center justify-center h-full p-8 text-muted-foreground">
            <div className="flex flex-col items-center space-y-2">
              <svg
                className="animate-spin h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>Loading spreadsheet...</span>
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default MultiSheetViewer;
