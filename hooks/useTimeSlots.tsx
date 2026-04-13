"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TimeSlot {
  id: string;
  start_time: string;
  end_time: string;
  date: string;
  max_capacity: number;
  bookedCount: number;
  attendees: Attendee[];
}

export interface Attendee {
  id: string;
  name: string;
  email: string;
}

export const useTimeSlots = () => {
  const {
    data: timeSlots = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["timeSlots"],
    queryFn: async () => {
      const { data: slots, error: slotsError } = await supabase
        .from("time_slots")
        .select(
          `
          *,
          bookings (
            id,
            name,
            email
          )
        `
        )
        .order("start_time");

      if (slotsError) throw slotsError;

      const transformedSlots: TimeSlot[] = slots.map((slot) => ({
        id: slot.id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        date: slot.date,
        max_capacity: slot.max_capacity,
        bookedCount: slot.bookings?.length || 0,
        attendees:
          slot.bookings?.map((booking: { id: string; name: string; email: string }) => ({
            id: booking.id,
            name: booking.name,
            email: booking.email,
          })) || [],
      }));

      return transformedSlots;
    },
  });

  const createBooking = async (
    slotId: string,
    attendeeData: { name: string; email: string }
  ) => {
    const { data: existingBookings, error: checkError } = await supabase
      .from("bookings")
      .select("id")
      .eq("email", attendeeData.email);

    if (checkError) throw checkError;
    if (existingBookings?.length > 0) {
      throw new Error("You have already booked a slot with this email.");
    }

    const { data: slotData, error: slotError } = await supabase
      .from("time_slots")
      .select("start_time, end_time")
      .eq("id", slotId)
      .single();
    if (slotError) throw slotError;

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        time_slot_id: slotId,
        name: attendeeData.name,
        email: attendeeData.email,
      })
      .select()
      .single();

    if (error) throw error;
    await refetch();
    return {
      ...data,
      slot_start_time: slotData.start_time,
      slot_end_time: slotData.end_time,
    };
  };

  return {
    timeSlots,
    isLoading,
    error,
    createBooking,
    refetch,
  };
};
