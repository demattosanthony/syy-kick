import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router";
import HomePage from "./pages/home";
import { Providers } from "./providers";
import MainAppLayout from "./components/layouts/main-app-layout";

function App() {
  return (
    <BrowserRouter>
      <Providers>
        <MainAppLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </MainAppLayout>
      </Providers>
    </BrowserRouter>
  );
}

export default App;
