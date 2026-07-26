import { useState } from "react";
import { registerUser } from "../api/auth";

function SignupForm() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // A message shown to the user (either success or an error)
  const [feedback, setFeedback] = useState("");

  async function handleSignup() {
    setFeedback("");

    // Simple check that nothing is empty
    if (username === "" || email === "" || password === "") {
      setFeedback("Please fill in all fields");
      return;
    }

    try {
      await registerUser(username, email, password);
      setFeedback("Account created successfully! You can now log in.");

      // Clear the form after success
      setUsername("");
      setEmail("");
      setPassword("");
    } catch (error) {
      // Show the error message the server sent back
      if (error instanceof Error) {
        setFeedback(error.message);
      } else {
        setFeedback("Something went wrong");
      }
    }
  }

  return (
    <div className="panel-in modal-card bg-white text-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-lg">
      <h2 className="text-2xl font-bold text-purple-700 mb-4 text-center">
        Create your Weavr account
      </h2>

      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-purple-500"
      />

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
        placeholder="Password"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:border-purple-500"
      />

      <button
        onClick={handleSignup}
        className="w-full bg-purple-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-purple-700 transition"
      >
        Sign Up
      </button>

      {feedback !== "" && (
        <p className="text-center text-sm mt-4 text-gray-700">{feedback}</p>
      )}
    </div>
  );
}

export default SignupForm;