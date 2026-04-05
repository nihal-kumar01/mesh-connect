export default function Home() {
  return (
    <div className="h-screen bg-[#0B0F14] text-white flex flex-col items-center justify-center text-center px-6">

      {/* Title */}
      <h1 className="text-4xl font-bold mb-4">
        Mesh Connect
      </h1>

      {/* Tagline */}
      <p className="text-gray-400 max-w-md mb-6">
        A decentralized communication system that works even when the internet is shut down.
        Messages relay through nearby devices using mesh networking.
      </p>
      <p className="text-yellow-400 text-sm mb-6">
      ⚠ Designed for war zones, disasters & internet shutdown scenarios
    </p>

      {/* Highlight Points */}
      <div className="text-sm text-gray-500 mb-8 space-y-1">
        <p>📡 Peer-to-peer communication</p>
        <p>🔒 End-to-end encrypted</p>
        <p>🌐 Works without internet</p>
      </div>

      {/* CTA Button */}
      <a
        href="/chat"
        className="bg-green-500 px-6 py-3 rounded-full font-semibold hover:bg-green-600 transition"
      >
        Enter Network →
      </a>

    </div>
  );
}