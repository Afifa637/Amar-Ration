const QRScanner = () => {
  return (
    <div className="bg-white p-5 rounded-lg shadow h-full">
      <h3 className="font-semibold mb-3">OMS কিউআর স্ক্যান</h3>

      <div className="border border-dashed h-48 flex items-center justify-center text-gray-500">
        📷 ক্যামেরা প্রিভিউ এখানে
      </div>

      <button className="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
        স্ক্যান শুরু করুন
      </button>
    </div>
  );
};

export default QRScanner;
