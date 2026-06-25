"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
    >
      Print Label
    </button>
  );
}
