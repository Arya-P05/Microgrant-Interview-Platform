import React from "react";
import { VCProfile } from "@/data/vcs";

export const VCProfileCard: React.FC<{ vc: VCProfile }> = ({ vc }) => (
  <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 mb-4">
    <img
      src={vc.image}
      alt={vc.name}
      className="w-12 h-12 rounded-full object-cover border border-zinc-600"
    />
    <div className="min-w-0">
      <div className="font-medium text-zinc-200 text-sm">{vc.name}</div>
      <div className="text-xs text-zinc-500">
        {vc.title} @ {vc.company}
      </div>
      <div className="text-xs text-zinc-600 mt-0.5 line-clamp-2">{vc.bio}</div>
    </div>
  </div>
);
