const ActivityLog = () => {
  return (
    <div className="bg-white p-5 rounded-lg shadow h-full">
      <h3 className="font-semibold mb-3">কার্যক্রম লগ</h3>

      <ul className="text-sm text-gray-700 space-y-2">
        <li>✔ কিউআর স্ক্যান হয়েছে (উপকারভোগী C001)</li>
        <li>✔ টোকেন ইস্যু হয়েছে (C001)</li>
        <li>⚠ ওজন মিলেনি (Weight mismatch)</li>
      </ul>
    </div>
  );
};

export default ActivityLog;
