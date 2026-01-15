type StatCardProps = {
  title: string;
  value: string | number;
  color: string;
};

const StatCard = ({ title, value, color }: StatCardProps) => {
  return (
    <div className={`${color} p-5 rounded-lg shadow text-white`}>
      <h3 className="text-sm">{title}</h3>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
};

export default StatCard;
