import { useState } from "react";
import { loginUser } from "../api/auth";
import { saveSession } from "../auth/session";
import type { StoredUser } from "../auth/session";

// The parent (App) passes down a function to call when login succeeds
type LoginFormProps = {
  onLoginSuccess: (user: StoredUser) => void;
};

function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState("");

  async function handleLogin() {
    setFeedback("");

    if (email === "" || password === "") {
      setFeedback("Please fill in all fields");
      return;
    }

    try {
      const data = await loginUser(email, password);
      saveSession(data.token, data.user);

      // Tell App we're logged in - App will switch to the chat screen
      onLoginSuccess(data.user);
    } catch (error) {
      if (error instanceof Error) {
        setFeedback(error.message);
      } else {
        setFeedback("Something went wrong");
      }
    }
  }

  return (
    <div className="bg-white text-gray-800 rounded-xl w-full max-w-sm p-6 shadow-lg">
      <h2 className="text-2xl font-bold text-purple-700 mb-4 text-center">
        Log in to Weavr
      </h2>

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-purple-500"
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleLogin();
          }
        }}
        placeholder="Password"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:border-purple-500"
      />

      <button
        onClick={handleLogin}
        className="w-full bg-purple-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-purple-700 transition"
      >
        Log In
      </button>

      {feedback !== "" && (
        <p className="text-center text-sm mt-4 text-gray-700">{feedback}</p>
      )}
    </div>
  );
}

export default LoginForm;