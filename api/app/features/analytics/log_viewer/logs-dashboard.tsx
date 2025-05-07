// Define the type for a single log entry
type LogEntry = {
  id: string;
  level: string;
  message: string;
  meta: any; // Or a more specific type if the meta structure is known
  timestamp: Date;
};

// Define the props type for the component
type LogsDashboardProps = {
  logsData: LogEntry[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
};

// Format Date function
const formatDate = (date: Date | null | string): string => {
  if (!date) return "N/A";
  try {
    const d = new Date(date);
    // Combine date and time using locale-specific formats
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  } catch (e) {
    console.error("Error formatting date:", date, e); // Add logging
    return "Invalid Date";
  }
};

export function LogsDashboard({
  logsData,
  currentPage,
  totalPages,
  pageSize,
}: LogsDashboardProps) {
  return (
    <html>
      <head>
        <title>Syykick Logs</title>
        <meta charSet="utf-8" />
        <style>
          {`
            body { font-family: sans-serif; margin: 20px; background-color: #f4f4f4; color: #333; }
            h1 { text-align: center; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; background-color: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #e9e9e9; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            tr:hover { background-color: #f1f1f1; }
            .log-meta { white-space: pre-wrap; word-break: break-all; background-color: #282c34; color: #abb2bf; padding: 10px; border-radius: 4px; font-family: monospace; }
            .level-info { color: green; }
            .level-error { color: red; font-weight: bold; }
            .level-warn { color: orange; }
          `}
        </style>
      </head>
      <body>
        <h1>Syykick Application Logs</h1>
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Level</th>
              <th>Message</th>
              <th>Meta</th>
            </tr>
          </thead>
          <tbody>
            {logsData.map((log) => (
              <tr key={log.id}>
                <td>{formatDate(log.timestamp)}</td>
                <td className={`level-${log.level.toLowerCase()}`}>
                  {log.level}
                </td>
                <td>{log.message}</td>
                <td>
                  {log.meta && Object.keys(log.meta).length > 0 ? (
                    <pre className="log-meta">
                      {JSON.stringify(log.meta, null, 2)}
                    </pre>
                  ) : (
                    "N/A"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: "20px", textAlign: "center" }}>
          {currentPage > 1 && (
            <a
              href={`?page=${currentPage - 1}&pageSize=${pageSize}`}
              style={{ marginRight: "10px" }}
            >
              Previous
            </a>
          )}
          <span>
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages && (
            <a
              href={`?page=${currentPage + 1}&pageSize=${pageSize}`}
              style={{ marginLeft: "10px" }}
            >
              Next
            </a>
          )}
        </div>
      </body>
    </html>
  );
}
