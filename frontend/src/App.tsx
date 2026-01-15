import { BrowserRouter, Routes, Route } from "react-router-dom";
import DistributorLayout from "./layouts/DistributorLayout";
import DistributorDashboard from "./pages/DistributorDashboard";
import Login from "./pages/Login";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route element={<DistributorLayout />}>
          <Route path="/dashboard" element={<DistributorDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
