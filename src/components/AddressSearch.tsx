"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export type AddressEntry = {
  id: string;
  type: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postcode?: string | null;
  country: string;
  isDefault: boolean;
};

interface Props {
  type: "shipper" | "receiver";
  onSelect: (entry: AddressEntry) => void;
}

export default function AddressSearch({ type, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 1) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/address-book?q=${encodeURIComponent(q)}&type=${type}`);
      const data = await res.json();
      if (data.success) {
        setResults(data.data);
        setOpen(data.data.length > 0);
      }
    } finally {
      setLoading(false);
    }
  }, [type]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 250);
  }

  function handleSelect(entry: AddressEntry) {
    onSelect(entry);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative mb-3">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => query.length > 0 && results.length > 0 && setOpen(true)}
          placeholder="Search address book by name or phone…"
          className="w-full pl-9 pr-3 py-2 border border-blue-200 bg-blue-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white placeholder:text-gray-400"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => handleSelect(entry)}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 flex items-start gap-3 border-b border-gray-50 last:border-0"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                  {entry.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm text-gray-900 flex items-center gap-2">
                    {entry.name}
                    {entry.isDefault && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-normal">default</span>
                    )}
                  </div>
                  {entry.phone && <div className="text-xs text-gray-500">{entry.phone}</div>}
                  {(entry.city || entry.country) && (
                    <div className="text-xs text-gray-400">{[entry.city, entry.country].filter(Boolean).join(", ")}</div>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
