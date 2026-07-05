import LoginForm from "./components/LoginForm";

function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 px-6">
      <div className="flex items-center gap-3 mb-6">
        <img src="/logo.png" alt="Weavr logo" className="w-12 h-12" />
        <span className="text-3xl font-bold text-white">Weavr</span>
      </div>

      <LoginForm />
    </div>
  );
}

export default App;