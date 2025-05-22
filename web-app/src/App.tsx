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
  ShareThreadPage,
  ThreadPage,
  WorkflowsPage,
  WorkflowPage,
  WorkflowRunPageDetails,
  WorkflowRunsPage,
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
import { User } from "./types/user";
import { RouteErrorElement } from "./components/route-error";
import { ProjectWorkflowsPage } from "./pages/projects/[:projectId]/workflows/page";

// Define the new loader function for the root route
const rootUserDataLoader = async (): Promise<User | null> => {
  const queryKey = ["me"];
  try {
    // Check local storage for user data
    const userData = localStorage.getItem("me");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      // Check that the user data is not empty
      if (parsedUser && Object.keys(parsedUser).length > 0) {
        return parsedUser;
      }
      // If the data is empty, continue with the cache or the API
    }

    console.log("1. Local storage userData : ", userData);
    // Try fetching from the cache first
    const cachedData = queryClient.getQueryData<User>(queryKey);
    if (cachedData) {
      return cachedData;
    }

    console.log("2. Cache userData : ", cachedData);

    // If not in cache, fetch from API using fetchQuery
    const user = await queryClient.fetchQuery<User | null>({
      queryKey,
      queryFn: async () => {
        console.log("3. Fetching from API");
        const result = await api.auth.me();
        return result;
      },
    });

    console.log("3. API userData : ", user);

    if (user) {
      console.log("4. API userData is not null, return user");
      return user;
    } else {
      console.log("4. API userData is null");
      return null;
    }
  } catch (error) {
    console.error("6. Erreur:", error);
    return null;
  }
};

// Root element component to decide layout based on loader data
const RootElement = () => {
  const userData = useLoaderData() as Awaited<
    ReturnType<typeof rootUserDataLoader>
  >;

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
    errorElement: <RouteErrorElement />,
    children: [
      {
        path: "/",
        element: <RootElement />,
        errorElement: <RouteErrorElement />,
        loader: rootUserDataLoader,
        children: [
          { index: true, element: <HomePage /> },
          { path: "threads", element: <ThreadsPage /> },
          { path: "threads/:threadId", element: <ThreadPage /> },
          { path: "workflows", element: <WorkflowsPage /> },
          { path: "workflows/:workflowId", element: <WorkflowPage /> },
          { path: "workflows/:workflowId/runs", element: <WorkflowRunsPage /> },
          {
            path: "workflows/:workflowId/runs/:runId",
            element: <WorkflowRunPageDetails />,
          },
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
