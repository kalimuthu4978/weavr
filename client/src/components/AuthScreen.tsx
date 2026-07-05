import { useState } from "react";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";
import type { StoredUser } from "../auth/session";

type AuthScreenProps = {
  onAuthSuccess: (user: StoredUser) => void;
};

function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  // Which form is showing: "login" or "signup"
  const [mode, setMode] = useState("login");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 px-6">
      <div className="flex items-center gap-3 mb-6">
        <img src="/logo.png" alt="Weavr logo" className="w-12 h-12" />
        <span className="text-3xl font-bold text-white">Weavr</span>
      </div>

      {mode === "login" ? (
        <LoginForm onLoginSuccess={onAuthSuccess} />
      ) : (
        <SignupForm />
      )}

      {/* Link to switch between the two forms */}
      <div className="mt-4 text-white text-sm">
        {mode === "login" ? (
          <p>
            Don't have an account?{" "}
            <button
              onClick={() => setMode("signup")}
              className="underline font-semibold"
            >
              Sign up
            </button>
          </p>
        ) : (
          <p>
            Already have an account?{" "}
            <button
              onClick={() => setMode("login")}
              className="underline font-semibold"
            >
              Log in
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

export default AuthScreen;