"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import schedule from "@/data/sponsorCoffeeChatWindows.json";

interface CoffeeChatWindow {
  name: string;
  slug: string;
  aliases?: string[];
  startTime: string;
  endTime: string;
  locationLabel: string;
  slotMinutes: number;
  hackersPerSlot: number;
  rooms: CoffeeChatRoomConfig[];
}

interface CoffeeChatRoomConfig {
  label: string;
  roomName: string;
}

export interface CoffeeChatRoom {
  id: string;
  label: string;
  room_name?: string | null;
}

export interface CoffeeChatSlot {
  id: string;
  starts_at: string;
  ends_at: string;
  location_label: string;
  slot_minutes: number;
  room_count: number;
  capacity: number;
  booked_count: number;
  available_count: number;
  is_full: boolean;
}

export interface CoffeeChatSponsor {
  id: string;
  name: string;
  slug: string;
  notes: string | null;
  location_label: string | null;
  room_labels?: string[];
  rooms?: CoffeeChatRoom[];
  slot_minutes: number;
  hackers_per_slot: number;
  slots: CoffeeChatSlot[];
}

export interface CoffeeChatStudent {
  id: string;
  full_name: string;
  email: string;
}

export interface CoffeeChatBooking {
  id: string;
  sponsor_id: string;
  sponsor_name: string;
  slot_id: string;
  room_id: string;
  room_label: string;
  room_name?: string | null;
  starts_at: string;
  ends_at: string;
  location_label: string;
  slot_minutes?: number;
  created_at: string;
}

export interface CoffeeChatInvite {
  valid: boolean;
  reason?: string;
  student?: CoffeeChatStudent;
  sponsors?: CoffeeChatSponsor[];
  existing_bookings?: CoffeeChatBooking[];
  expires_at?: string | null;
  requires_email_verification?: boolean;
  rules?: {
    booking_limit?: "one_per_sponsor" | string;
    overlaps?: "blocked" | string;
    room_assignment?: "random_available_room" | string;
  };
}

export interface CoffeeChatBookingResult {
  status: "booked";
  booking: CoffeeChatBooking;
}

export interface CoffeeChatBookingRequest {
  slotId: string;
  roomId?: string | null;
}

const demoDate = schedule.eventDate;
function localIso(date: string, minutesFromMidnight: number) {
  const hours = Math.floor(minutesFromMidnight / 60);
  const minutes = minutesFromMidnight % 60;
  return new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    hours,
    minutes
  ).toISOString();
}

function minutes(time: string) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function buildDemoRooms(
  sponsorSlug: string,
  rooms: CoffeeChatRoomConfig[]
): CoffeeChatRoom[] {
  return rooms.map((room, index) => ({
    id: `${sponsorSlug}-room-${index + 1}`,
    label: room.label,
    room_name: room.roomName,
  }));
}

function buildDemoInvite(): CoffeeChatInvite {
  return {
    valid: true,
    requires_email_verification: false,
    rules: {
      booking_limit: "one_per_sponsor",
      overlaps: "blocked",
      room_assignment: "random_available_room",
    },
    student: {
      id: "demo-student",
      full_name: "Demo Student",
      email: "demo@student.com",
    },
    existing_bookings: [],
    sponsors: schedule.sponsors.map((window: CoffeeChatWindow) => {
      const slots: CoffeeChatSlot[] = [];
      const slotMinutes = window.slotMinutes || schedule.slotMinutes;
      const rooms = buildDemoRooms(window.slug, window.rooms);
      for (
        let current = minutes(window.startTime);
        current + slotMinutes <= minutes(window.endTime);
        current += slotMinutes
      ) {
        slots.push({
          id: `${window.slug}-${current}`,
          starts_at: localIso(demoDate, current),
          ends_at: localIso(demoDate, current + slotMinutes),
          location_label: window.locationLabel,
          slot_minutes: slotMinutes,
          room_count: window.rooms.length,
          capacity: window.hackersPerSlot,
          booked_count: 0,
          available_count: window.hackersPerSlot,
          is_full: false,
        });
      }

      return {
        id: window.slug,
        name: window.name,
        slug: window.slug,
        notes: null,
        location_label: window.locationLabel,
        room_labels: rooms.map((room) => room.label),
        rooms,
        slot_minutes: slotMinutes,
        hackers_per_slot: window.hackersPerSlot,
        slots,
      };
    }),
  };
}

export function getCoffeeChatErrorMessage(message: string) {
  if (message.includes("already_booked")) {
    return "This invite has already booked that sponsor.";
  }
  if (message.includes("slot_overlaps_existing_booking")) {
    return "That time overlaps another coffee chat you booked.";
  }
  if (message.includes("slot_full")) {
    return "That slot was just booked. Please choose another time.";
  }
  if (message.includes("not_eligible_for_sponsor")) {
    return "This invite is not eligible for that sponsor.";
  }
  if (message.includes("slot_closed")) {
    return "That slot is no longer available.";
  }
  if (message.includes("invalid_invite")) {
    return "This invitation link is no longer available.";
  }
  if (message.includes("booking_conflict_retry")) {
    return "Something changed while booking. Please refresh and try again.";
  }
  return message || "Something went wrong.";
}

export function useCoffeeChatInvite(token: string | undefined) {
  const queryClient = useQueryClient();
  const isDemo = process.env.NODE_ENV === "development" && token === "demo";

  const inviteQuery = useQuery({
    queryKey: ["coffee-chat-invite", token],
    enabled: Boolean(token),
    queryFn: async () => {
      if (isDemo) return buildDemoInvite();

      const { data, error } = await supabase.rpc("get_coffee_chat_invite", {
        p_token: token ?? "",
      });

      if (error) throw new Error(getCoffeeChatErrorMessage(error.message));
      return data as unknown as CoffeeChatInvite;
    },
  });

  const bookSlot = useMutation({
    mutationFn: async ({ slotId, roomId }: CoffeeChatBookingRequest) => {
      if (isDemo) {
        const sponsor = inviteQuery.data?.sponsors?.find((item) =>
          item.slots.some((slot) => slot.id === slotId)
        );
        const slot = sponsor?.slots.find((item) => item.id === slotId);
        if (!sponsor || !slot) throw new Error("Slot not found.");
        const rooms = sponsor.rooms ?? [];
        const requestedRoom = rooms.find((room) => room.id === roomId);
        const roomIndex = Math.floor(
          Math.random() * Math.max(rooms.length, 1)
        );
        const room = requestedRoom ?? rooms[roomIndex];
        return {
          status: "booked",
          booking: {
            id: "demo-booking",
            sponsor_id: sponsor.id,
            sponsor_name: sponsor.name,
            slot_id: slot.id,
            room_id: room?.id ?? `${sponsor.id}-room-${roomIndex + 1}`,
            room_label: room?.label ?? slot.location_label,
            room_name: room?.room_name ?? null,
            starts_at: slot.starts_at,
            ends_at: slot.ends_at,
            location_label: slot.location_label,
            slot_minutes: slot.slot_minutes,
            created_at: new Date().toISOString(),
          },
        } satisfies CoffeeChatBookingResult;
      }

      const { data, error } = await supabase.rpc("book_coffee_chat_slot", {
        p_token: token ?? "",
        p_slot_id: slotId,
        p_room_id: roomId ?? null,
      });

      if (error) throw new Error(getCoffeeChatErrorMessage(error.message));
      return data as unknown as CoffeeChatBookingResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coffee-chat-invite", token] });
    },
  });

  return {
    invite: inviteQuery.data,
    isLoading: inviteQuery.isLoading,
    error: inviteQuery.error,
    refetch: inviteQuery.refetch,
    bookSlot,
    isDemo,
  };
}
