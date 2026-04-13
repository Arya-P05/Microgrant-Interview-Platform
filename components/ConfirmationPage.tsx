"use client";

import React from "react";
import { TimeSlot, Attendee } from "@/hooks/useTimeSlots";
import { CheckCircle, Calendar, Clock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ConfirmationPageProps {
  booking: {
    slot: TimeSlot;
    attendee: Attendee;
  };
  onNewBooking: () => void;
}

const ConfirmationPage = ({ booking, onNewBooking }: ConfirmationPageProps) => {
  const { slot, attendee } = booking;

  const formatTime = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, "0")} ${ampm}`;
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 text-center">
      <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
      <h1 className="text-xl font-medium text-zinc-100 mb-1">
        Booking confirmed
      </h1>
      <p className="text-sm text-zinc-400 mb-8">
        Thanks, {attendee.name}. Your slot is booked.
      </p>

      <div className="p-4 rounded-lg bg-zinc-800 border border-zinc-700 text-left mb-4">
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
          Details
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-zinc-200">
            <Calendar className="w-4 h-4 text-zinc-500 shrink-0" />
            Monday, July 14
          </div>
          <div className="flex items-center gap-2 text-zinc-200">
            <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
            {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
          </div>
          <div className="flex items-center gap-2 text-zinc-400 text-xs">
            <Mail className="w-4 h-4 text-zinc-500 shrink-0" />
            Confirmation sent to {attendee.email}
          </div>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-800/30 text-left mb-6">
        <div className="text-xs font-medium text-emerald-300 mb-2">
          What’s next
        </div>
        <ul className="text-xs text-zinc-400 space-y-1">
          <li>Check email for the Meet link</li>
          <li>Add to your calendar</li>
          <li>Join 3–5 min early</li>
        </ul>
      </div>

      <Button
        onClick={onNewBooking}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
      >
        Book another
      </Button>
      <p className="mt-4 text-xs text-zinc-500">
        <Link href="/round2" className="text-emerald-400 hover:text-emerald-300">
          Round 2
        </Link>
        {" · "}
        <a
          href="mailto:microgrants@hackthenorth.com"
          className="text-zinc-500 hover:text-zinc-400"
        >
          Contact
        </a>
      </p>
    </div>
  );
};

export default ConfirmationPage;
