const Topbar = () => {
  return (
    <div className="bg-white shadow px-6 py-4 flex justify-between items-center">
      <h1 className="text-lg font-semibold">Distributor Dashboard</h1>
      <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
        Logout
      </button>
    </div>
  );
};

export default Topbar;
