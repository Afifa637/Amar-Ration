import { useNavigate } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white p-6 rounded shadow w-80">
        <h2 className="text-lg font-bold mb-4">Distributor Login</h2>

        <button
          onClick={() => navigate("/dashboard")}
          className="bg-green-600 text-white w-full py-2 rounded"
        >
          Login as Distributor
        </button>
      </div>
    </div>
  );
};

export default Login;
