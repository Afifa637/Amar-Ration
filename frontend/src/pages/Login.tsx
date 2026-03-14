import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Legacy login stub - the app uses LoginPage.tsx instead.
const Login = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/", { replace: true });
  }, [navigate]);

  return null;
};

export default Login;
