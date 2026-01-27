const ConsumerTable = () => {
  const consumers = [
    { id: "C001", name: "রহিম", status: "সক্রিয়" },
    { id: "C002", name: "করিম", status: "নিষ্ক্রিয়" },
  ];

  return (
    <div className="bg-white p-5 rounded-lg shadow">
      <h3 className="font-semibold mb-3">সংক্ষিপ্ত তালিকা (উপকারভোগী)</h3>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2 border text-left">আইডি</th>
              <th className="p-2 border text-left">নাম</th>
              <th className="p-2 border text-left">স্ট্যাটাস</th>
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
    </div>
  );
};

export default ConsumerTable;
