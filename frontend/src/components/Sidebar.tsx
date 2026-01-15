import { Link } from "react-router-dom";

const Sidebar = () => {
  return (
    <div className="w-64 bg-green-700 text-white p-5 flex flex-col">
      <h2 className="text-xl font-bold mb-6">Smart OMS</h2>

      <nav className="space-y-3">
        <Link
          to="/dashboard"
          className="block bg-green-800 p-3 rounded hover:bg-green-600"
        >
          📊 Dashboard
        </Link>

        <button className="text-left block w-full p-3 rounded hover:bg-green-600">
          📷 Scan QR
        </button>

        <button className="text-left block w-full p-3 rounded hover:bg-green-600">
          👥 Consumers
        </button>

        <button className="text-left block w-full p-3 rounded hover:bg-green-600">
          📦 Stock
        </button>

        <button className="text-left block w-full p-3 rounded hover:bg-green-600">
          📝 Activity Log
        </button>
      </nav>
    </div>
  );
};

export default Sidebar;
