function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 text-white px-6">

      {/* Logo icon */}
      <img
        src="/logo.png"
        alt="Weavr logo"
        className="w-24 h-24 mb-6"
      />

      {/* App name */}
      <h1 className="text-5xl font-bold mb-3">
        Weavr
      </h1>

      {/* Tagline */}
      <p className="text-lg text-purple-100 mb-10">
        Every Conversation Connected
      </p>

      {/* Call-to-action buttons (not wired up yet - just the look for now) */}
      <div className="flex gap-4">
        <button className="bg-white text-purple-700 font-semibold px-6 py-3 rounded-lg hover:bg-purple-50 transition">
          Log In
        </button>
        <button className="bg-purple-800 text-white font-semibold px-6 py-3 rounded-lg hover:bg-purple-900 transition">
          Sign Up
        </button>
      </div>

    </div>
  );
}

export default App;