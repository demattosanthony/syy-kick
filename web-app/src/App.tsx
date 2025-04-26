import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router";
import {
  HomePage,
  LoginPage,
  PaymentSuccessPage,
  PrivacyPolicyPage,
  TermsOfUsePage,
  JoinOrgPage,
} from "./pages";
import { Providers } from "./providers";
import MainAppLayout from "./components/layouts/main-app-layout";

function App() {
  return (
    <BrowserRouter>
      <Providers>
        <Routes>
          {/* Routes with MainAppLayout */}
          <Route element={<MainAppLayout />}>
            <Route path="/" element={<HomePage />} />
          </Route>

          {/** Auth Pages */}
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/policies/privacy-policy"
            element={<PrivacyPolicyPage />}
          />
          <Route path="/policies/terms-of-use" element={<TermsOfUsePage />} />

          <Route path="/success" element={<PaymentSuccessPage />} />

          <Route path="/join-org" element={<JoinOrgPage />} />
        </Routes>

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
    </BrowserRouter>
  );
}

export default App;
