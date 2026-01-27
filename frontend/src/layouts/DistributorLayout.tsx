import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-[#eef1f5]">
      <Topbar />

      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <div className="px-4 py-3">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
