"use client";

import React from "react";
import Image from "next/image";

interface FeedCardProps {
  imageUrl: string;
  bunzAmount: number;
  username: string;
  device: string;
  timeAgo: string;
}

export default function FeedCard({
  imageUrl,
  bunzAmount,
  username,
  device,
  timeAgo,
}: FeedCardProps) {
  return (
    <article className="relative mb-5">
      {/* Image with 4:3 ratio */}
      <div className="relative w-full aspect-[4/3] rounded-[16px] overflow-hidden">
        <Image
          src={imageUrl}
          alt={username}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 400px"
        />

        {/* Floating bunz badge — top-left */}
        <span className="absolute top-3 left-3 bunz-badge">
          {bunzAmount} Bunz
        </span>
      </div>

      {/* Info row */}
      <div className="mt-2.5 flex items-center gap-2 px-1">
        <span className="text-[13px] font-normal text-[#111111] tracking-[-0.01em]">
          {username}
        </span>
        <span className="text-[13px] text-[#8a8a8a]">•</span>
        <span className="text-[12px] text-[#8a8a8a]">{device}</span>
        <span className="text-[12px] text-[#8a8a8a]">{timeAgo}</span>
      </div>
    </article>
  );
}
