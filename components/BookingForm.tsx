"use client";

import React, { useState } from "react";
import { TimeSlot } from "@/hooks/useTimeSlots";
import { ArrowLeft, User, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

interface BookingFormProps {
  slot: TimeSlot;
  onSubmit: (data: { name: string; email: string }) => void;
  onBack: () => void;
}

const BookingForm = ({ slot, onSubmit, onBack }: BookingFormProps) => {
  const [formData, setFormData] = useState({ name: "", email: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatTime = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, "0")} ${ampm}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error("Form submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const spotsLeft = slot.max_capacity - slot.bookedCount;

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="mb-6 -ml-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back
      </Button>
      <h1 className="text-xl font-medium text-zinc-100 mb-6">
        Book your interview
      </h1>

      <div className="p-3 rounded-lg bg-zinc-800 border border-zinc-700 mb-6">
        <p className="text-sm text-zinc-200">
          Monday, July 14 · {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label className="text-zinc-400 text-xs font-medium mb-1.5 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            Full name
          </Label>
          <Input
            className="bg-zinc-800 border-zinc-600 text-zinc-100 placeholder-zinc-500 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="Your name"
            required
          />
        </div>
        <div>
          <Label className="text-zinc-400 text-xs font-medium mb-1.5 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" />
            Email
          </Label>
          <Input
            type="email"
            className="bg-zinc-800 border-zinc-600 text-zinc-100 placeholder-zinc-500 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
            value={formData.email}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, email: e.target.value }))
            }
            placeholder="you@example.com"
            required
          />
        </div>
        <Button
          type="submit"
          disabled={isSubmitting || !formData.name || !formData.email}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {isSubmitting ? "Booking…" : "Confirm booking"}
        </Button>
      </form>
    </div>
  );
};

export default BookingForm;
