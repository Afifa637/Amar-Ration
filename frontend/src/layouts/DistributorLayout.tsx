import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

const TOPBAR_H = 88;
const SIDEBAR_W = 260;

export default function DistributorLayout() {
  return (
    <div className="min-h-screen bg-[#eef1f5]">
      {/* Fixed Topbar */}
      <div
        className="fixed top-0 left-0 right-0 z-50"
        style={{ height: TOPBAR_H }}
      >
        <Topbar />
      </div>

      {/* Fixed Sidebar */}
      <aside
        className="fixed left-0 z-40 bg-[#0d2b3a] text-white"
        style={{
          top: TOPBAR_H,
          width: SIDEBAR_W,
          height: `calc(100vh - ${TOPBAR_H}px)`,
        }}
      >
        <Sidebar />
      </aside>

      {/* Scrollable content */}
      <main
        className="min-h-screen"
        style={{
          paddingTop: TOPBAR_H,
          paddingLeft: SIDEBAR_W,
        }}
      >
        <div className="p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
