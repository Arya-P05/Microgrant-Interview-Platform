"use client";

import { useState } from "react";
import TimeSlotGrid from "@/components/TimeSlotGrid";
import BookingForm from "@/components/BookingForm";
import ConfirmationPage from "@/components/ConfirmationPage";
import { useTimeSlots, TimeSlot, Attendee } from "@/hooks/useTimeSlots";
import { toast } from "@/hooks/use-toast";
import emailjs from "@emailjs/browser";
import Link from "next/link";

function formatTo12Hour(timeStr: string) {
  if (!timeStr) return "";
  const [hourStr, minuteStr] = timeStr.split(":");
  let hour = parseInt(hourStr, 10);
  const minute = minuteStr;
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${ampm}`;
}

export default function Round1Page() {
  const [currentView, setCurrentView] = useState<
    "landing" | "booking" | "confirmation"
  >("landing");
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<{
    slot: TimeSlot;
    attendee: Attendee;
  } | null>(null);

  const { timeSlots, isLoading, error, createBooking } = useTimeSlots();

  const handleSlotSelect = (slot: TimeSlot) => {
    if (slot.bookedCount < slot.max_capacity) {
      setSelectedSlot(slot);
      setCurrentView("booking");
    }
  };

  const handleBookingSubmit = async (attendeeData: {
    name: string;
    email: string;
  }) => {
    if (!selectedSlot) return;

    try {
      const booking = await createBooking(selectedSlot.id, attendeeData);

      const newAttendee: Attendee = {
        id: booking.id,
        name: attendeeData.name,
        email: attendeeData.email,
      };

      try {
        await emailjs.send("service_9q7qa88", "template_t7qs0dr", {
          to_name: attendeeData.name.split(" ")[0],
          interview_start: formatTo12Hour(booking.slot_start_time?.slice(0, 5)),
          interview_end: formatTo12Hour(booking.slot_end_time?.slice(0, 5)),
          to_email: attendeeData.email,
        });
      } catch (emailErr) {
        toast({
          title: "Email Not Sent",
          description:
            "Your booking was successful, but we could not send a confirmation email. Please contact microgrants@hackthenorth.com.",
          variant: "destructive",
        });
      }

      const updatedSlot = timeSlots.find((s) => s.id === selectedSlot.id);

      setConfirmedBooking({
        slot: updatedSlot || selectedSlot,
        attendee: newAttendee,
      });
      setCurrentView("confirmation");

      toast({
        title: "Booking Confirmed!",
        description: "Your interview slot has been successfully booked.",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      if (message.includes("already booked a slot")) {
        toast({
          title: "Duplicate Booking",
          description:
            "You have already booked a slot with this email. If you need to change your slot, please contact microgrants@hackthenorth.com.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Booking Failed",
          description:
            "There was an error booking your slot. Please try again. If the error persists, please contact microgrants@hackthenorth.com.",
          variant: "destructive",
        });
      }
    }
  };

  const handleBackToSlots = () => {
    setCurrentView("landing");
    setSelectedSlot(null);
  };

  const handleNewBooking = () => {
    setCurrentView("landing");
    setSelectedSlot(null);
    setConfirmedBooking(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-zinc-600 border-t-emerald-500 mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Loading slots…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-zinc-400 text-sm mb-4">Couldn’t load time slots.</p>
          <Link href="/round1" className="text-emerald-400 hover:text-emerald-300 text-sm">
            Try again
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 py-6 flex justify-end gap-4 text-sm">
        <Link href="/round2" className="text-zinc-500 hover:text-zinc-300">
          Round 2
        </Link>
      </div>
      {currentView === "landing" && (
        <TimeSlotGrid timeSlots={timeSlots} onSlotSelect={handleSlotSelect} />
      )}

      {currentView === "booking" && selectedSlot && (
        <BookingForm
          slot={selectedSlot}
          onSubmit={handleBookingSubmit}
          onBack={handleBackToSlots}
        />
      )}

      {currentView === "confirmation" && confirmedBooking && (
        <ConfirmationPage
          booking={confirmedBooking}
          onNewBooking={handleNewBooking}
        />
      )}
    </div>
  );
}
