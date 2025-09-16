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
  UserSettings,
  ForbiddenPage,
  LandingPage,
  IntegrationsPage,
  FilesPage,
} from "./pages";
import { Providers } from "./providers";
import MainAppLayout from "./components/layouts/main-app-layout";
import { queryClient } from "./providers/tanstack-query-client-provider";
import api from "./lib/api";
import { User } from "./types/user";
import { RouteErrorElement } from "./components/route-error";

// Define the new loader function for the root route
const rootUserDataLoader = async (): Promise<User | null> => {
  const queryKey = ["me"];
  try {
    // If not in cache, fetch from API using fetchQuery
    const user = await queryClient.fetchQuery<User | null>({
      queryKey,
      queryFn: async () => {
        const result = await api.auth.me();
        return result;
      },
    });

    if (user) {
      return user;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error:", error);
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
          { path: "settings", element: <UserSettings /> },
          { path: "integrations", element: <IntegrationsPage /> },
          { path: "files", element: <FilesPage /> },
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
