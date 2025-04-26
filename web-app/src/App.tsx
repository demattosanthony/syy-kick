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
  SitesPage,
  UserSettings,
  ProjectsPage,
  ProjectPage,
  ProjectTree,
  ProjectBlob,
  ProjectSettingsPage,
  ProjectIssuesPage,
  NewIssuePage,
  IssueDetailPage,
  ProjectWorkflowsPage,
  ProjectWorkflowPage,
  KnowledgeBasesPage,
  KnowledgeBasePage,
  KnowledgeBaseTreePage,
  KnowledgeBaseBlobPage,
  KnowledgeBaseSettingsPage,
  ForbiddenPage,
} from "./pages";
import { Providers } from "./providers";
import MainAppLayout from "./components/layouts/main-app-layout";
import ProjectPageLayout from "./components/layouts/project-layout";
import { queryClient } from "./providers/tanstack-query-client-provider";
import api from "./lib/api";
import { KnowledgeBaseLayout } from "./components/layouts/knowledge-base-layout";

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
        <Outlet />
        <div
          id="microsoft-picker-overlay"
          className="fixed inset-0 bg-black/80 hidden"
          style={{ zIndex: 999 }}
        />
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
          { path: "/sites", element: <SitesPage /> },
          { path: "/settings", element: <UserSettings /> },
          { path: "/projects", element: <ProjectsPage /> },
          {
            path: "/projects/:projectId",
            element: <ProjectPageLayout />,
            children: [
              { index: true, element: <ProjectPage /> },
              { path: "tree/*", element: <ProjectTree /> },
              { path: "blob/*", element: <ProjectBlob /> },
              { path: "settings", element: <ProjectSettingsPage /> },
              { path: "issues", element: <ProjectIssuesPage /> },
              { path: "issues/new", element: <NewIssuePage /> },
              { path: "issues/:issueNumber", element: <IssueDetailPage /> },
              { path: "workflows", element: <ProjectWorkflowsPage /> },
              {
                path: "workflows/:workflowId",
                element: <ProjectWorkflowPage />,
              },
            ],
          },
          {
            path: "knowledge-bases",
            element: <KnowledgeBasesPage />,
          },
          {
            path: "knowledge-bases/:kbId",
            element: <KnowledgeBaseLayout />,
            children: [
              { index: true, element: <KnowledgeBasePage /> },
              { path: "tree/*", element: <KnowledgeBaseTreePage /> },
              { path: "blob/*", element: <KnowledgeBaseBlobPage /> },
              { path: "settings", element: <KnowledgeBaseSettingsPage /> },
            ],
          },
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
      {
        path: "*",
        element: <ForbiddenPage />,
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
