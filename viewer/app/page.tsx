export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-2xl p-12 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">Sharene</h1>
        <p className="text-xl text-gray-600 mb-8">
          Secure, encrypted photo sharing
        </p>
        <p className="text-gray-500">
          To view a shared photo, click the link sent to you.
        </p>
      </div>
    </div>
  );
}

