"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineLocationMarker,
  HiOutlineLockClosed,
  HiOutlineUser,
} from "react-icons/hi";
import {
  CoffeeChatBooking,
  CoffeeChatRoom,
  CoffeeChatSlot,
  CoffeeChatSponsor,
  useCoffeeChatInvite,
} from "@/hooks/useCoffeeChatInvite";
import { toast } from "@/hooks/use-toast";

const timeZone = "America/Toronto";

function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatSlot(slot: CoffeeChatSlot | CoffeeChatBooking) {
  return `${formatTime(slot.starts_at)}-${formatTime(slot.ends_at)}`;
}

function roomShortLabel(room: string) {
  return room.trim().replace(/^PSE\s+/i, "");
}

function roomGroupLabel(rooms: string[] | undefined, fallback: string | null) {
  if (!rooms?.length) return fallback ?? "Location pending";

  const allPseRooms = rooms.every((room) => /^PSE\s+/i.test(room.trim()));
  const labels = rooms.map(roomShortLabel).join(", ");
  return allPseRooms ? `PSE ${labels}` : labels;
}

function hasOnlyPseRooms(rooms: string[]) {
  return (
    rooms.length > 0 && rooms.every((room) => /^PSE\s+/i.test(room.trim()))
  );
}

function bookingRoomLabel(booking: CoffeeChatBooking) {
  return booking.room_name
    ? `${booking.room_label} (${booking.room_name})`
    : booking.room_label;
}

function roomDisplayLabel(room: CoffeeChatRoom) {
  return room.room_name ? `${room.label} (${room.room_name})` : room.label;
}

function chooseSponsorRoom(sponsor: CoffeeChatSponsor) {
  const rooms = sponsor.rooms ?? [];
  if (rooms.length === 0) return null;

  return rooms[Math.floor(Math.random() * rooms.length)];
}

const pendingSelectionMaxAgeMs = 24 * 60 * 60 * 1000;

interface PendingCoffeeChatSelection {
  sponsorId: string;
  slotId: string;
  roomId?: string | null;
  updatedAt: number;
}

function pendingSelectionKey(token: string | undefined) {
  return token ? `coffee-chat-pending-selection:${token}` : null;
}

function readPendingSelection(
  token: string | undefined
): PendingCoffeeChatSelection | null {
  const storageKey = pendingSelectionKey(token);
  if (!storageKey || typeof window === "undefined") return null;

  try {
    const rawSelection = window.localStorage.getItem(storageKey);
    if (!rawSelection) return null;

    const parsed = JSON.parse(rawSelection) as Partial<PendingCoffeeChatSelection>;
    if (
      typeof parsed.sponsorId !== "string" ||
      typeof parsed.slotId !== "string" ||
      typeof parsed.updatedAt !== "number"
    ) {
      return null;
    }

    return {
      sponsorId: parsed.sponsorId,
      slotId: parsed.slotId,
      roomId:
        typeof parsed.roomId === "string" || parsed.roomId === null
          ? parsed.roomId
          : undefined,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

function savePendingSelection(
  token: string | undefined,
  selection: PendingCoffeeChatSelection
) {
  const storageKey = pendingSelectionKey(token);
  if (!storageKey || typeof window === "undefined") return;

  window.localStorage.setItem(storageKey, JSON.stringify(selection));
}

function clearPendingSelection(token: string | undefined) {
  const storageKey = pendingSelectionKey(token);
  if (!storageKey || typeof window === "undefined") return;

  window.localStorage.removeItem(storageKey);
}

function groupSlotsByDay(slots: CoffeeChatSlot[]) {
  return slots.reduce<Record<string, CoffeeChatSlot[]>>((groups, slot) => {
    const day = formatDay(slot.starts_at);
    groups[day] = [...(groups[day] ?? []), slot];
    return groups;
  }, {});
}

function overlapsBooking(slot: CoffeeChatSlot, booking: CoffeeChatBooking) {
  return (
    new Date(booking.starts_at).getTime() < new Date(slot.ends_at).getTime() &&
    new Date(slot.starts_at).getTime() < new Date(booking.ends_at).getTime()
  );
}

function mergeBookings(
  serverBookings: CoffeeChatBooking[],
  localBookings: CoffeeChatBooking[]
) {
  const bySponsor = new Map<string, CoffeeChatBooking>();

  for (const booking of [...serverBookings, ...localBookings]) {
    bySponsor.set(booking.sponsor_id, booking);
  }

  return [...bySponsor.values()].sort(
    (left, right) =>
      new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime()
  );
}

export default function CoffeeChatInvitePage() {
  const params = useParams<{ token: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const { invite, isLoading, error, bookSlot } = useCoffeeChatInvite(token);

  const [selectedSponsorId, setSelectedSponsorId] = useState<string | null>(
    null
  );
  const [selectedSlot, setSelectedSlot] = useState<CoffeeChatSlot | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<CoffeeChatRoom | null>(null);
  const [localBookings, setLocalBookings] = useState<CoffeeChatBooking[]>([]);

  const sponsors = useMemo(() => invite?.sponsors ?? [], [invite?.sponsors]);
  const confirmedBookings = useMemo(
    () => mergeBookings(invite?.existing_bookings ?? [], localBookings),
    [invite?.existing_bookings, localBookings]
  );
  const bookedSponsorIds = useMemo(
    () => new Set(confirmedBookings.map((booking) => booking.sponsor_id)),
    [confirmedBookings]
  );
  const bookableSponsors = useMemo(
    () => sponsors.filter((sponsor) => !bookedSponsorIds.has(sponsor.id)),
    [bookedSponsorIds, sponsors]
  );

  useEffect(() => {
    if (!invite?.valid || selectedSlot) return;

    const pendingSelection = readPendingSelection(token);
    if (!pendingSelection) return;

    if (Date.now() - pendingSelection.updatedAt > pendingSelectionMaxAgeMs) {
      clearPendingSelection(token);
      return;
    }

    const pendingSponsor = bookableSponsors.find(
      (sponsor) => sponsor.id === pendingSelection.sponsorId
    );
    const pendingSlot = pendingSponsor?.slots.find(
      (slot) => slot.id === pendingSelection.slotId
    );

    if (
      !pendingSponsor ||
      !pendingSlot ||
      pendingSlot.is_full ||
      confirmedBookings.some((booking) => overlapsBooking(pendingSlot, booking))
    ) {
      clearPendingSelection(token);
      return;
    }

    const pendingRoom =
      pendingSponsor.rooms?.find((room) => room.id === pendingSelection.roomId) ??
      chooseSponsorRoom(pendingSponsor);

    window.setTimeout(() => {
      setSelectedSponsorId(pendingSponsor.id);
      setSelectedSlot(pendingSlot);
      setSelectedRoom(pendingRoom);
    }, 0);

    if (pendingRoom?.id !== pendingSelection.roomId) {
      savePendingSelection(token, {
        sponsorId: pendingSponsor.id,
        slotId: pendingSlot.id,
        roomId: pendingRoom?.id ?? null,
        updatedAt: Date.now(),
      });
    }
  }, [bookableSponsors, confirmedBookings, invite?.valid, selectedSlot, token]);

  const activeSelectedSponsorId =
    selectedSponsorId &&
    bookableSponsors.some((sponsor) => sponsor.id === selectedSponsorId)
      ? selectedSponsorId
      : (bookableSponsors[0]?.id ?? null);
  const selectedSponsor = bookableSponsors.find(
    (sponsor) => sponsor.id === activeSelectedSponsorId
  );
  const selectableSlots = useMemo(
    () =>
      (selectedSponsor?.slots ?? []).filter(
        (slot) =>
          !confirmedBookings.some((booking) => overlapsBooking(slot, booking))
      ),
    [confirmedBookings, selectedSponsor?.slots]
  );
  const slotsByDay = useMemo(
    () => groupSlotsByDay(selectableSlots),
    [selectableSlots]
  );
  const student = invite?.student;

  async function confirmBooking() {
    if (!selectedSlot || !selectedSponsor) return;

    const roomForBooking = selectedRoom ?? chooseSponsorRoom(selectedSponsor);

    try {
      const result = await bookSlot.mutateAsync({
        slotId: selectedSlot.id,
        roomId: roomForBooking?.id,
      });
      setLocalBookings((bookings) =>
        mergeBookings(bookings, [result.booking])
      );
      setSelectedSlot(null);
      setSelectedRoom(null);
      setSelectedSponsorId(null);
      clearPendingSelection(token);
      toast({
        title: "Coffee chat booked",
        description: `${result.booking.sponsor_name} at ${formatSlot(result.booking)}, ${bookingRoomLabel(result.booking)}`,
      });
    } catch (bookingError) {
      const message =
        bookingError instanceof Error
          ? bookingError.message
          : "Could not book that slot.";
      toast({
        title: "Booking failed",
        description: message,
        variant: "destructive",
      });
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-zinc-700 border-t-emerald-400 animate-spin" />
      </main>
    );
  }

  if (error || !invite || !invite.valid) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-4">
        <section className="w-full max-w-md border border-zinc-800 bg-zinc-900/70 rounded-lg p-6 text-center">
          <HiOutlineLockClosed className="mx-auto h-9 w-9 text-zinc-500 mb-4" />
          <h1 className="text-lg font-medium">Invitation unavailable</h1>
          <p className="mt-2 text-sm text-zinc-400">
            This coffee-chat link is expired, revoked, or not connected yet.
          </p>
          {error && (
            <p className="mt-3 text-xs text-zinc-500">
              {error instanceof Error ? error.message : "Could not load invite."}
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="border-b border-zinc-800 pb-6">
          <div>
            <p className="text-xs font-medium uppercase text-emerald-300">
              Hack the North
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal">
              Coffee chats
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              {student?.full_name ? (
                <>Private invite for {student.full_name}</>
              ) : (
                "Private invite"
              )}
            </p>
          </div>
        </header>

        {confirmedBookings.length > 0 && (
          <section className="mt-6 border border-emerald-900/60 bg-emerald-950/20 rounded-lg p-5">
            <div className="flex items-center gap-2">
              <HiOutlineCheckCircle className="h-5 w-5 text-emerald-400" />
              <h2 className="text-sm font-medium text-emerald-100">
                Confirmed chats
              </h2>
            </div>
            <div className="mt-4 grid gap-3">
              {confirmedBookings.map((booking) => (
                <div
                  key={`${booking.sponsor_id}-${booking.slot_id}`}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4"
                >
                  <div className="font-medium">{booking.sponsor_name}</div>
                  <div className="mt-3 grid gap-2 text-sm text-zinc-400 sm:grid-cols-3">
                    <div>
                      <HiOutlineClock className="mb-1 h-4 w-4 text-zinc-500" />
                      <div>{formatSlot(booking)}</div>
                      <div className="text-zinc-500">
                        {formatDay(booking.starts_at)}
                      </div>
                    </div>
                    <div>
                      <HiOutlineLocationMarker className="mb-1 h-4 w-4 text-zinc-500" />
                      <div>{bookingRoomLabel(booking)}</div>
                    </div>
                    <div>
                      <HiOutlineUser className="mb-1 h-4 w-4 text-zinc-500" />
                      <div>{student?.full_name}</div>
                      <div className="text-zinc-500">{student?.email}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-3">
            {sponsors.map((sponsor) => {
              const booking = confirmedBookings.find(
                (item) => item.sponsor_id === sponsor.id
              );
              const isSelected = selectedSponsor?.id === sponsor.id;
              const isBooked = Boolean(booking);
              const roomLabels = sponsor.room_labels?.length
                ? sponsor.room_labels
                : sponsor.location_label
                  ? [sponsor.location_label]
                  : [];
              const roomSummary = roomGroupLabel(
                roomLabels,
                sponsor.location_label
              );
              const roomPrefix = hasOnlyPseRooms(roomLabels)
                ? "PSE"
                : "Rooms";

              return (
                <button
                  type="button"
                  key={sponsor.id}
                  disabled={isBooked}
                  onClick={() => {
                    setSelectedSponsorId(sponsor.id);
                    setSelectedSlot(null);
                    setSelectedRoom(null);
                    clearPendingSelection(token);
                  }}
                  className={`w-full rounded-lg border p-4 text-left transition-colors active:scale-[0.98] disabled:cursor-default ${
                    isSelected && !isBooked
                      ? "border-emerald-500/50 bg-emerald-950/20"
                      : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 disabled:hover:border-zinc-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{sponsor.name}</div>
                      <span className="sr-only">Rooms {roomSummary}</span>
                      <div
                        aria-hidden="true"
                        className="mt-2 flex flex-wrap items-center gap-1.5"
                      >
                        <span className="text-[11px] text-zinc-600">
                          {roomPrefix}
                        </span>
                        {roomLabels.length > 0 ? (
                          roomLabels.map((room) => (
                            <span
                              key={room}
                              className="rounded-md border border-zinc-800 bg-zinc-950/70 px-1.5 py-0.5 text-[11px] leading-4 text-zinc-400"
                            >
                              {roomShortLabel(room)}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-500">
                            Location pending
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-zinc-600">
                        {sponsor.slot_minutes} min
                      </div>
                    </div>
                    {isBooked && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                        Booked
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </aside>

          <section className="min-w-0">
            {selectedSponsor && (
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-medium">
                    {selectedSponsor.name}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Pick one available time below.
                  </p>
                </div>
              </div>
            )}

            {bookableSponsors.length === 0 && (
              <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-8 text-center lg:h-full lg:min-h-0">
                <HiOutlineCheckCircle className="mx-auto h-9 w-9 text-emerald-400" />
                <h3 className="mt-3 text-lg font-medium">You are all set</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
                  Your selected sponsor chats are confirmed.
                </p>
              </div>
            )}

            {selectedSponsor && Object.keys(slotsByDay).length === 0 && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center text-sm text-zinc-500">
                No non-overlapping slots are available for this sponsor.
              </div>
            )}

            <div className="space-y-5">
              {Object.entries(slotsByDay).map(([day, slots]) => (
                <div key={day}>
                  <div className="mb-2 text-sm font-medium text-zinc-400">
                    {day}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                    {slots.map((slot) => {
                      const selected = selectedSlot?.id === slot.id;
                      return (
                        <button
                          type="button"
                          key={slot.id}
                          disabled={slot.is_full}
                          onClick={() => {
                            if (!selectedSponsor) return;
                            const room = chooseSponsorRoom(selectedSponsor);
                            setSelectedSlot(slot);
                            setSelectedRoom(room);
                            savePendingSelection(token, {
                              sponsorId: selectedSponsor.id,
                              slotId: slot.id,
                              roomId: room?.id ?? null,
                              updatedAt: Date.now(),
                            });
                          }}
                          className={`h-16 rounded-lg border px-3 text-left transition-colors active:scale-[0.98] disabled:cursor-not-allowed ${
                            selected
                              ? "border-emerald-500 bg-emerald-950/30 text-emerald-100"
                              : slot.is_full
                                ? "border-zinc-900 bg-zinc-900/40 text-zinc-600"
                                : "border-zinc-800 bg-zinc-900/70 text-zinc-200 hover:border-zinc-700"
                          }`}
                        >
                          <div className="text-lg font-semibold leading-6">
                            {formatTime(slot.starts_at)}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {slot.is_full
                              ? "Full"
                              : `${slot.available_count} ${slot.available_count === 1 ? "spot" : "spots"} open`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {selectedSlot && selectedSponsor && (
              <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-base font-semibold">
                      {formatSlot(selectedSlot)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
                      <span>{formatDay(selectedSlot.starts_at)}</span>
                      <span>
                        {selectedRoom
                          ? roomDisplayLabel(selectedRoom)
                          : "Room assigned after confirming"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:min-w-[260px]">
                    <button
                      type="button"
                      onClick={confirmBooking}
                      disabled={bookSlot.status === "pending"}
                      className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {bookSlot.status === "pending"
                        ? "Booking..."
                        : "Confirm booking"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
