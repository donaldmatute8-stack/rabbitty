"use client";

import React, { useState } from "react";
import { Search, X } from "lucide-react";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-[#ffffff] flex flex-col">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-[#f0f0f0]">
        <div className="flex-1 flex items-center gap-2 bg-[#f7f7f7] rounded-full px-3 py-2">
          <Search size={16} color="#8a8a8a" strokeWidth={1.6} />
          <input
            autoFocus
            type="text"
            placeholder="Search users, styles, tags..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-[14px] text-[#111111] placeholder-[#8a8a8a] outline-none"
          />
        </div>
        <button
          onClick={onClose}
          className="p-1 text-[#111111] active:opacity-60"
        >
          <X size={22} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center text-[#8a8a8a] text-sm">
        {query ? `Search results for "${query}"` : "Type to search"}
      </div>
    </div>
  );
}
