const QRScanner = () => {
  return (
    <div className="bg-white p-5 rounded-lg shadow h-full">
      <h3 className="font-semibold mb-3">Scan OMS QR</h3>

      <div className="border border-dashed h-48 flex items-center justify-center text-gray-500">
        📷 Camera Preview Here
      </div>

      <button className="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
        Start Scan
      </button>
    </div>
  );
};

export default QRScanner;
