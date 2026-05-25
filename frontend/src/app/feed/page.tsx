"use client";

import React, { useState } from "react";
import Header from "@/components/Header";
import AnimatedTabs from "@/components/AnimatedTabs";
import FeedCard from "@/components/FeedCard";
import BottomNav from "@/components/BottomNav";
import SearchOverlay from "@/components/SearchOverlay";
import QRScanner from "@/components/QRScanner";

const TABS = [
  { id: "bunzin", label: "bunz'in" },
  { id: "stock", label: "Stock" },
  { id: "freehands", label: "Freehands" },
];

const MOCK_FEED = [
  {
    id: 1,
    imageUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&q=80",
    bunzAmount: 25,
    username: "marco_design",
    device: "Sony A7IV",
    timeAgo: "2h ago",
  },
  {
    id: 2,
    imageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=600&q=80",
    bunzAmount: 12,
    username: "sarah_travels",
    device: "Fujifilm X-T5",
    timeAgo: "5h ago",
  },
  {
    id: 3,
    imageUrl: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&q=80",
    bunzAmount: 8,
    username: "nature_lens",
    device: "Canon R6",
    timeAgo: "1d ago",
  },
];

export default function FeedPage() {
  const [activeTab, setActiveTab] = useState("bunzin");
  const [activeNav, setActiveNav] = useState<"home" | "search" | "scan" | "bag">("home");
  const [searchOpen, setSearchOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const handleNav = (key: "home" | "search" | "scan" | "bag") => {
    if (key === "search") {
      setSearchOpen(true);
      return;
    }
    if (key === "scan") {
      setScanOpen(true);
      return;
    }
    setActiveNav(key);
  };

  const handleScan = (data: string) => {
    console.log("QR scanned:", data);
    // TODO: call API /api/v1/transactions/scan
  };

  return (
    <>
      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <QRScanner isOpen={scanOpen} onClose={() => setScanOpen(false)} onScan={handleScan} />

      <div className="min-h-screen bg-[#ffffff] pb-20">
        <Header />

        <AnimatedTabs
          tabs={TABS}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as string)}
        />

        <main className="px-4 pt-4">
          {activeTab === "bunzin" && (
            <div className="space-y-2">
              {MOCK_FEED.map((item) => (
                <FeedCard
                  key={item.id}
                  imageUrl={item.imageUrl}
                  bunzAmount={item.bunzAmount}
                  username={item.username}
                  device={item.device}
                  timeAgo={item.timeAgo}
                />
              ))}
            </div>
          )}

          {activeTab === "stock" && (
            <div className="flex items-center justify-center h-40 text-[#8a8a8a] text-sm">
              Stock feed coming soon
            </div>
          )}

          {activeTab === "freehands" && (
            <div className="flex items-center justify-center h-40 text-[#8a8a8a] text-sm">
              Freehands feed coming soon
            </div>
          )}
        </main>

        <BottomNav active={activeNav} onChange={handleNav} />
      </div>
    </>
  );
}
