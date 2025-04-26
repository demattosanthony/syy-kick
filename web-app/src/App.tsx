import "./App.css";
import { createBrowserRouter, RouterProvider, Outlet } from "react-router";
import {
  HomePage,
  LoginPage,
  PaymentSuccessPage,
  PrivacyPolicyPage,
  TermsOfUsePage,
  JoinOrgPage,
  ThreadsPage,
  ThreadPage,
  WorkflowsPage,
  WorkflowPage,
} from "./pages";
import { Providers } from "./providers";
import MainAppLayout from "./components/layouts/main-app-layout";
import { queryClient } from "./providers/tanstack-query-client-provider";
import api from "./lib/api";

// Define the loader function
const mainAppLoader = async () => {
  const queryKey = ["me"];
  // Ensure the data is fetched or retrieved from cache
  return (
    queryClient.getQueryData(queryKey) ??
    (await queryClient.fetchQuery({ queryKey, queryFn: () => api.auth.me() }))
  );
};

// Define routes using the object-based format
const router = createBrowserRouter([
  {
    // Root element that includes Providers and Outlet
    element: (
      <Providers>
        <Outlet /> {/* Render matched child route here */}
        {/* iframe can be moved here if it should be present on all routes */}
        <iframe
          id="microsoft-picker-iframe"
          style={{
            width: "70%",
            height: "600px",
            border: "none",
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1000,
            display: "none",
          }}
          name="microsoftPickerFrame"
        />
      </Providers>
    ),
    // Nest all other routes as children
    children: [
      {
        element: <MainAppLayout />,
        loader: mainAppLoader, // Loader for routes using MainAppLayout
        children: [
          { path: "/", element: <HomePage /> },
          { path: "/threads", element: <ThreadsPage /> },
          { path: "/threads/:threadId", element: <ThreadPage /> },
          { path: "/workflows", element: <WorkflowsPage /> },
          { path: "/workflows/:workflowId", element: <WorkflowPage /> },
        ],
      },
      {
        path: "/login",
        element: <LoginPage />,
      },
      {
        path: "/policies/privacy-policy",
        element: <PrivacyPolicyPage />,
      },
      {
        path: "/policies/terms-of-use",
        element: <TermsOfUsePage />,
      },
      {
        path: "/success",
        element: <PaymentSuccessPage />,
      },
      {
        path: "/join-org",
        element: <JoinOrgPage />,
      },
    ],
  },
]);

function App() {
  // Render only the RouterProvider
  return <RouterProvider router={router} />;
}

export default App;
