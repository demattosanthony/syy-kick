import React from "react";

// Define the type for a single user object in the props
type UserData = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  lastActiveAt: Date | null;
  sessionCount: number;
};

// Define the props type for the component
type AnalyticsDashboardProps = {
  usersData: UserData[];
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

export function AnalyticsDashboard({ usersData }: AnalyticsDashboardProps) {
  return (
    <html>
      <head>
        <title>User Activity Dashboard</title>
        <meta charSet="utf-8" />
        <style>
          {`
            body { font-family: sans-serif; margin: 20px; }
            h1 { text-align: center; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #f2f2f2; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            tr:hover { background-color: #f1f1f1; }
            .user-link { color: #007bff; text-decoration: none; }
            .user-link:hover { text-decoration: underline; }
          `}
        </style>
      </head>
      <body>
        <h1>Syykick Analytics Dashboard</h1>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Registration Date</th>
              <th>Last Active Time</th>
              <th>Sessions</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </body>
    </html>
  );
}
