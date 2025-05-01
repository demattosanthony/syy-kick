import "./App.css";
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  useLoaderData,
} from "react-router";
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
  LandingPage,
} from "./pages";
import { Providers } from "./providers";
import MainAppLayout from "./components/layouts/main-app-layout";
import ProjectPageLayout from "./components/layouts/project-layout";
import { queryClient } from "./providers/tanstack-query-client-provider";
import api from "./lib/api";
import { KnowledgeBaseLayout } from "./components/layouts/knowledge-base-layout";
import { ShareThreadPage } from "./pages/share/[threadId]/page";
import { User } from "./types/user";
import { CreateWorkflowPage } from "./pages/workflows/create/page";
import { WorkflowRunsPage } from "./pages/workflows/[workflowId]/runs/page";
import { WorkflowRunPageDetails } from "./pages/workflows/[workflowId]/runs/[runId]/page";

// Define the new loader function for the root route
const rootUserDataLoader = async (): Promise<User | null> => {
  const queryKey = ["me"];
  try {
    // Check local storage for user data
    const userData = localStorage.getItem("me");
    if (userData) {
      return JSON.parse(userData);
    }

    // Try fetching from the cache first
    const cachedData = queryClient.getQueryData<User>(queryKey);
    if (cachedData) {
      return cachedData;
    }

    // If not in cache, fetch from API using fetchQuery
    const user = await queryClient.fetchQuery<User | null>({
      queryKey,
      queryFn: async () => {
        const result = await api.auth.me();
        return result; // Return User or null
      },
    });

    if (user) {
      return user; // Return user data if fetch is successful
    } else {
      return null; // Explicitly return null if fetchQuery resolves to null
    }
  } catch (error) {
    // If fetch throws an error (e.g., 401 Unauthorized), return null
    return null;
  }
};

// Root element component to decide layout based on loader data
const RootElement = () => {
  // Use useLoaderData which gets data resolved by the loader function
  const userData = useLoaderData() as Awaited<
    ReturnType<typeof rootUserDataLoader>
  >;

  // Unauthenticated users will see the landing page
  return userData ? <MainAppLayout /> : <LandingPage />;
};

// Define routes using the object-based format
const router = createBrowserRouter([
  {
    // Root element for Providers ONLY
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
    children: [
      {
        path: "/",
        element: <RootElement />,
        loader: rootUserDataLoader,
        children: [
          { index: true, element: <HomePage /> },
          { path: "threads", element: <ThreadsPage /> },
          { path: "threads/:threadId", element: <ThreadPage /> },
          { path: "workflows", element: <WorkflowsPage /> },
          { path: "workflows/:workflowId", element: <WorkflowPage /> },
          { path: "workflows/:workflowId/runs", element: <WorkflowRunsPage /> },
          { path: "workflows/:workflowId/runs/:runId", element: <WorkflowRunPageDetails /> },
          { path: "workflows/create", element: <CreateWorkflowPage /> },
          { path: "sites", element: <SitesPage /> },
          { path: "settings", element: <UserSettings /> },
          { path: "projects", element: <ProjectsPage /> },
          {
            path: "projects/:projectId",
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
        path: "/onboarding/orgs/join/:token",
        element: <JoinOrgPage />,
      },
      {
        path: "/share/:threadId",
        element: <ShareThreadPage />,
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
