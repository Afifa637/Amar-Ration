import { Routes, Route, Navigate, BrowserRouter } from "react-router-dom";
import DistributorLayout from "./layouts/DistributorLayout";
import DistributorDashboard from "./pages/DistributorDashboard";
import Login from "./pages/Login";

export default function App() {
  return (
    <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<DistributorLayout />}>
            <Route path="/dashboard" element={<DistributorDashboard />} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    </BrowserRouter>
  );
}

