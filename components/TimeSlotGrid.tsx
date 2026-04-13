"use client";

import React from "react";
import { TimeSlot } from "@/hooks/useTimeSlots";
import { Clock } from "lucide-react";

interface TimeSlotGridProps {
  timeSlots: TimeSlot[];
  onSlotSelect: (slot: TimeSlot) => void;
}

const TimeSlotGrid = ({ timeSlots, onSlotSelect }: TimeSlotGridProps) => {
  const formatTime = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, "0")} ${ampm}`;
  };

  const getSlotStyles = (slot: TimeSlot) => {
    const spotsLeft = slot.max_capacity - slot.bookedCount;
    if (spotsLeft === 0)
      return "bg-zinc-800/50 border-zinc-700 text-zinc-500 cursor-not-allowed";
    if (spotsLeft === 1)
      return "bg-amber-950/30 border-amber-800/50 text-amber-400 hover:border-amber-600 cursor-pointer";
    return "bg-emerald-950/30 border-emerald-800/50 text-emerald-400 hover:border-emerald-600 cursor-pointer";
  };

  const getAvailabilityText = (slot: TimeSlot) => {
    const spotsLeft = slot.max_capacity - slot.bookedCount;
    if (spotsLeft === 0) return "Full";
    if (spotsLeft === 1) return "1 left";
    return `${spotsLeft} left`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-medium text-zinc-100 mb-1">
          Round 1 · Pick a slot
        </h1>
        <p className="text-sm text-zinc-500">
          Can’t make these?{" "}
          <a
            href="mailto:microgrants@hackthenorth.com"
            className="text-emerald-400 hover:text-emerald-300"
          >
            microgrants@hackthenorth.com
          </a>
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {timeSlots.map((slot) => {
          const spotsLeft = slot.max_capacity - slot.bookedCount;
          const isFull = spotsLeft === 0;

          return (
            <button
              type="button"
              key={slot.id}
              onClick={() => !isFull && onSlotSelect(slot)}
              className={`flex items-center justify-between p-4 rounded-lg border text-left transition ${getSlotStyles(
                slot
              )}`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0 text-zinc-500" />
                <span className="font-medium text-sm">
                  {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">
                  {slot.bookedCount}/{slot.max_capacity}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    isFull
                      ? "bg-zinc-700 text-zinc-500"
                      : spotsLeft === 1
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-emerald-500/20 text-emerald-400"
                  }`}
                >
                  {getAvailabilityText(slot)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TimeSlotGrid;
