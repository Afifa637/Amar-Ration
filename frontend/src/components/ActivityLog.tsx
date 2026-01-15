const ActivityLog = () => {
  return (
    <div className="bg-white p-5 rounded-lg shadow h-full">
      <h3 className="font-semibold mb-3">Activity Log</h3>

      <ul className="text-sm text-gray-700 space-y-2">
        <li>✔ QR scanned for Consumer C001</li>
        <li>✔ Token issued for C001</li>
        <li>⚠ Weight mismatch detected</li>
      </ul>
    </div>
  );
};

export default ActivityLog;
