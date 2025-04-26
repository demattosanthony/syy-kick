// Define the type for a single user object in the props
type UserData = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  lastActiveAt: Date | null;
  sessionCount: number;
  threadCount: number;
  messageCount: number;
};

// Define document stats type
type DocumentStats = {
  total: number;
  processing: number;
  pending: number;
};

// Define the props type for the component
type AnalyticsDashboardProps = {
  usersData: UserData[];
  documentStats: DocumentStats;
};

// Format Date function
const formatDate = (date: Date | null | string): string => {
  if (!date) return "N/A";
  try {
    return new Date(date).toLocaleString(); // Or use a more specific format
  } catch (e) {
    return "Invalid Date";
  }
};

export function AnalyticsDashboard({
  usersData,
  documentStats,
}: AnalyticsDashboardProps) {
  return (
    <html>
      <head>
        <title>Syykick Analytics</title>
        <meta charSet="utf-8" />
        <style>
          {`
            body { font-family: sans-serif; margin: 20px; }
            h1 { text-align: center; color: #333; }
            h2 { margin-top: 40px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #f2f2f2; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            tr:hover { background-color: #f1f1f1; }
            .user-link { color: #007bff; text-decoration: none; }
            .user-link:hover { text-decoration: underline; }
            .stats-container { display: flex; justify-content: space-around; padding: 20px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 5px; margin-top: 20px; }
            .stat-item { text-align: center; }
            .stat-item h3 { margin-bottom: 5px; color: #555; }
            .stat-item p { font-size: 24px; font-weight: bold; color: #333; margin: 0; }
          `}
        </style>
      </head>
      <body>
        <h1>Syykick Analytics Dashboard</h1>

        {/* User Activity Section */}
        <div id="users-content">
          <h2>User Activity</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Registration Date</th>
                <th>Last Active Time</th>
                <th>Sessions</th>
                <th>Threads Created</th>
                <th>Messages Sent</th>
              </tr>
            </thead>
            <tbody>
              {usersData.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>{formatDate(user.lastActiveAt)}</td>
                  <td>{user.sessionCount}</td>
                  <td>{user.threadCount}</td>
                  <td>{user.messageCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Document Processing Section */}
        <div id="documents-content">
          <h2>Document Processing Status</h2>
          <div className="stats-container">
            <div className="stat-item">
              <h3>Total Documents</h3>
              <p>{documentStats.total}</p>
            </div>
            <div className="stat-item">
              <h3>Processing</h3>
              <p>{documentStats.processing}</p>
            </div>
            <div className="stat-item">
              <h3>Pending</h3>
              <p>{documentStats.pending}</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
