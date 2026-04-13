"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Round2TimeSlot {
  id: string;
  vc_email: string;
  vc_name: string;
  start_time: string;
  end_time: string;
  created_at: string;
}

export interface Round2Booking {
  id: string;
  slot_id: string;
  name: string;
  email: string;
  created_at: string;
}

export function useRound2Slots() {
  const queryClient = useQueryClient();

  const {
    data: slots = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["round2_slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("round2_time_slots")
        .select("*")
        .order("start_time");
      if (error) throw error;
      return data as Round2TimeSlot[];
    },
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["round2_bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("round2_bookings")
        .select("*");
      if (error) throw error;
      return data as Round2Booking[];
    },
  });

  const bookSlot = useMutation({
    mutationFn: async ({
      slot_id,
      name,
      email,
    }: {
      slot_id: string;
      name: string;
      email: string;
    }) => {
      const { data, error } = await supabase
        .from("round2_bookings")
        .insert({ slot_id, name, email })
        .select()
        .single();
      if (error) throw error;
      return data as Round2Booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["round2_bookings"] });
    },
  });

  return { slots, bookings, isLoading, error, bookSlot };
}
