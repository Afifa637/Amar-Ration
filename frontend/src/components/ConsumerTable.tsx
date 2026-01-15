const ConsumerTable = () => {
  const consumers = [
    { id: "C001", name: "Rahim", status: "Active" },
    { id: "C002", name: "Karim", status: "Inactive" },
  ];

  return (
    <div className="bg-white p-5 rounded-lg shadow">
      <h3 className="font-semibold mb-3">Short List Consumers</h3>

      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2 border">ID</th>
            <th className="p-2 border">Name</th>
            <th className="p-2 border">Status</th>
          </tr>
        </thead>
        <tbody>
          {consumers.map((c) => (
            <tr key={c.id} className="border">
              <td className="p-2 border">{c.id}</td>
              <td className="p-2 border">{c.name}</td>
              <td className="p-2 border">{c.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ConsumerTable;
