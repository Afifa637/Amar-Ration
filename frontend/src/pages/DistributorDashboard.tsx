import StatCard from "../components/StatCard";
import QRScanner from "../components/QRScanner";
import ConsumerTable from "../components/ConsumerTable";
import ActivityLog from "../components/ActivityLog";

const DistributorDashboard = () => {
  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Total Consumers" value={120} color="bg-blue-500" />
        <StatCard title="Active Today" value={85} color="bg-green-500" />
        <StatCard title="Tokens Issued" value={60} color="bg-yellow-500" />
        <StatCard title="Stock Left (kg)" value={250} color="bg-red-500" />
      </div>

      {/* Main Content Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: QR Scanner */}
        <div className="col-span-1">
          <QRScanner />
        </div>

        {/* Middle: Consumer Table */}
        <div className="col-span-2">
          <ConsumerTable />
        </div>
      </div>

      {/* Bottom: Activity Log */}
      <ActivityLog />
    </div>
  );
};

export default DistributorDashboard;
