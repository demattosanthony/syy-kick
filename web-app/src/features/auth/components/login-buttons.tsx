import { Button } from "../../../components/ui/button";
import { Link } from "react-router";

const LoginButtons = () => {
  return (
    <div className="flex items-center gap-2">
      <Link to="/login">
        <Button>Login</Button>
      </Link>
      <Link to="/login">
        <Button variant="secondary">Sign up</Button>
      </Link>
    </div>
  );
};

export default LoginButtons;
