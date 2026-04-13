"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRound2Slots, Round2TimeSlot } from "@/hooks/useRound2Slots";
import { toast } from "@/hooks/use-toast";
import {
  HiOutlineUser,
  HiOutlineMail,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineCalendar,
} from "react-icons/hi";
import { VC_PROFILES } from "@/data/vcs";
import { VCProfileCard } from "@/components/VCProfileCard";
import emailjs from "@emailjs/browser";
import { MEET_LINKS } from "@/data/meetLinks";
import { toZonedTime, format } from "date-fns-tz";

function formatDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function getHourLabel(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const vcCompanyMap: Record<string, string> = {
  "jimmy yun": "8VC",
  "irene (heejin) koo": "Soma Capital",
  "andrew martinko": "Velocity",
  "krysta traianovski": "Velocity",
  "mischa hamara": "Next36",
};

function getCompanyForVC(name: string) {
  const key = name.trim().toLowerCase();
  return vcCompanyMap[key] || "";
}

function findMeetLink(vcName: string, dateKey: string, startTime24: string) {
  let meetKey = `${vcName}|${dateKey}|${startTime24}`;
  if (MEET_LINKS[meetKey]) return MEET_LINKS[meetKey];

  const [hour, minute] = startTime24.split(":").map(Number);
  for (let m = minute - 15; m >= 0; m -= 15) {
    const padded = m.toString().padStart(2, "0");
    meetKey = `${vcName}|${dateKey}|${hour.toString().padStart(2, "0")}:${padded}`;
    if (MEET_LINKS[meetKey]) return MEET_LINKS[meetKey];
  }
  meetKey = `${vcName}|${dateKey}|${hour.toString().padStart(2, "0")}:00`;
  if (MEET_LINKS[meetKey]) return MEET_LINKS[meetKey];
  return "No link available";
}

export default function Round2Page() {
  const { slots, bookings, isLoading, error, bookSlot } = useRound2Slots();
  const [selectedHour, setSelectedHour] = useState<{
    day: string;
    hour: number;
  } | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Round2TimeSlot | null>(null);
  const [form, setForm] = useState({ name: "", email: "" });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmedSlot, setConfirmedSlot] = useState<Round2TimeSlot | null>(
    null
  );

  const calendar = useMemo(() => {
    const map: Record<string, Record<number, Round2TimeSlot[]>> = {};
    slots.forEach((slot) => {
      const date = new Date(slot.start_time);
      const day = formatDate(date);
      const hour = date.getHours();
      if (!map[day]) map[day] = {};
      if (!map[day][hour]) map[day][hour] = [];
      map[day][hour].push(slot);
    });
    return map;
  }, [slots]);

  const weekDays = [
    "2025-07-28",
    "2025-07-29",
    "2025-07-30",
    "2025-07-31",
    "2025-08-01",
  ];

  const todayDate = formatDate(new Date());

  const hours = useMemo(() => {
    const hourSet = new Set<number>();
    slots.forEach((slot) => {
      hourSet.add(new Date(slot.start_time).getHours());
    });
    return Array.from(hourSet).sort((a, b) => a - b);
  }, [slots]);

  const isSlotBooked = (slotId: string) =>
    bookings.some((b) => b.slot_id === slotId);

  const handleBook = async () => {
    if (!selectedSlot) return;
    const alreadyBooked = bookings.some(
      (b) => b.email.trim().toLowerCase() === form.email.trim().toLowerCase()
    );
    if (alreadyBooked) {
      toast({
        title: "Already Booked",
        description: "This email has already booked a slot.",
        variant: "destructive",
      });
      return;
    }
    try {
      const EST_TZ = "America/New_York";
      const startUTC = new Date(selectedSlot.start_time);
      const endUTC = new Date(selectedSlot.end_time);

      const start = toZonedTime(startUTC, EST_TZ);
      const end = toZonedTime(endUTC, EST_TZ);

      const dateKey = format(start, "yyyy-MM-dd", { timeZone: EST_TZ });
      const startTime24 = format(start, "HH:mm", { timeZone: EST_TZ });

      const dateStr = format(start, "EEEE, MMMM d", { timeZone: EST_TZ });
      const startTime = format(start, "h:mm a", { timeZone: EST_TZ });
      const endTime = format(end, "h:mm a", { timeZone: EST_TZ });
      const amOrPm = format(start, "a", { timeZone: EST_TZ });

      await bookSlot.mutateAsync({
        slot_id: selectedSlot.id,
        name: form.name,
        email: form.email,
      });

      try {
        await emailjs.send("service_9q7qa88", "template_v1ht2ny", {
          to_name: form.name,
          VC_name: form.name,
          date: dateStr,
          interview_start: startTime,
          interview_end: endTime,
          am_or_pm: amOrPm,
          to_email: form.email,
          link: findMeetLink(selectedSlot.vc_name, dateKey, startTime24),
        });
      } catch (emailErr) {
        toast({
          title: "Email Not Sent",
          description:
            "Your booking was successful, but we could not send a confirmation email. Please contact microgrants@hackthenorth.com.",
          variant: "destructive",
        });
      }

      setConfirmedSlot(selectedSlot);
      setShowConfirmation(true);
      setSelectedSlot(null);
      setForm({ name: "", email: "" });
      setSelectedHour(null);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      toast({
        title: "Booking failed",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  function getSlotBadge(slot: Round2TimeSlot) {
    const booked = isSlotBooked(slot.id);
    if (booked)
      return (
        <span className="ml-2 px-2 py-0.5 rounded bg-zinc-700 text-zinc-400 text-xs font-medium">
          Full
        </span>
      );
    return (
      <span className="ml-2 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-medium">
        Available
      </span>
    );
  }

  function slotTimeString(slot: Round2TimeSlot) {
    const start = new Date(slot.start_time);
    const end = new Date(slot.end_time);
    return `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  function slotDateString(slot: Round2TimeSlot) {
    const start = new Date(slot.start_time);
    return start.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-zinc-600 border-t-emerald-500" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400 text-sm">
        Error loading slots.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto px-4 py-6 flex justify-end gap-4 text-sm">
        <Link href="/round1" className="text-zinc-500 hover:text-zinc-300">
          Round 1
        </Link>
      </div>
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <h1 className="text-xl font-medium text-zinc-100 mb-1">
          Round 2 · VC interviews
        </h1>
        <p className="text-zinc-500 text-sm mb-8">
          Times in EST. Questions?{" "}
          <a
            href="mailto:microgrants@hackthenorth.com"
            className="text-emerald-400 hover:text-emerald-300"
          >
            microgrants@hackthenorth.com
          </a>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Hour
                </th>
                {weekDays.map((day, i) => (
                  <th
                    key={day}
                    className={`p-2 text-center text-sm font-medium min-w-[100px] ${
                      day === todayDate ? "text-emerald-400" : "text-zinc-400"
                    }`}
                  >
                    <div>{daysOfWeek[i]}</div>
                    <div className="text-xs font-normal text-zinc-500 mt-0.5">
                      {day}
                    </div>
                    {day === todayDate && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs">
                        Today
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map((hour) => (
                <tr key={hour}>
                  <td className="p-2 font-mono text-sm text-zinc-500 align-middle border-t border-zinc-800">
                    {getHourLabel(hour)}
                  </td>
                  {weekDays.map((day) => {
                    const slotsInCell = calendar[day]?.[hour] || [];
                    const isToday = day === todayDate;
                    const openSlots = slotsInCell.filter(
                      (slot) => !isSlotBooked(slot.id)
                    ).length;
                    const isFull = slotsInCell.length > 0 && openSlots === 0;
                    let cellColor = "";
                    if (isFull) {
                      cellColor =
                        "bg-red-950/50 border-red-900/50 text-red-400";
                    } else if (openSlots === 1 || openSlots === 2) {
                      cellColor =
                        "bg-orange-950/40 border-orange-800/50 text-orange-300";
                    } else if (openSlots > 2) {
                      cellColor =
                        "bg-cyan-950/40 border-cyan-800/50 text-cyan-300";
                    } else {
                      cellColor = "bg-zinc-900/50 border-zinc-800 text-zinc-600";
                    }
                    return (
                      <td
                        key={day + hour}
                        className={`align-middle border border-zinc-800 transition ${cellColor} shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] ${
                          slotsInCell.length > 0
                            ? "hover:ring-1 hover:ring-emerald-500/50 cursor-pointer" +
                              (isToday ? " ring-1 ring-emerald-500/50" : "")
                            : ""
                        } px-2 py-2 text-center text-sm font-medium`}
                        style={{ minWidth: 100, height: 52 }}
                        onClick={() =>
                          slotsInCell.length > 0 &&
                          setSelectedHour({ day, hour })
                        }
                      >
                        {slotsInCell.length > 0 ? (
                          <span>
                            {isFull ? "Full" : `${openSlots} slot${openSlots > 1 ? "s" : ""}`}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedHour && !selectedSlot && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-zinc-800">
              <h2 className="text-lg font-medium text-zinc-100">
                Select a slot
              </h2>
            </div>
            <div className="p-6">
              {(() => {
                const slots =
                  calendar[selectedHour.day]?.[selectedHour.hour] || [];
                if (slots.length === 0) return null;
                const vcName = slots[0].vc_name;
                const vcProfile = VC_PROFILES.find(
                  (vc) => vc.name.toLowerCase() === vcName.toLowerCase()
                );
                return vcProfile ? (
                  <VCProfileCard vc={vcProfile} />
                ) : null;
              })()}
              <div className="space-y-2 mt-4">
                {(calendar[selectedHour.day]?.[selectedHour.hour] || []).map(
                  (slot) => {
                    const booked = isSlotBooked(slot.id);
                    return (
                      <button
                        type="button"
                        key={slot.id}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition ${
                          booked
                            ? "bg-zinc-800/50 border-zinc-700 text-zinc-500 cursor-not-allowed"
                            : "bg-zinc-800/50 border-zinc-700 hover:border-emerald-500/50 hover:bg-zinc-800 cursor-pointer text-zinc-200"
                        }`}
                        onClick={() => !booked && setSelectedSlot(slot)}
                      >
                        <div>
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <HiOutlineClock className="text-zinc-500 shrink-0" />
                            {slotTimeString(slot)}
                            {getSlotBadge(slot)}
                          </div>
                          <div className="text-xs text-zinc-500 flex items-center mt-0.5">
                            <HiOutlineUser className="mr-1 shrink-0" />
                            {slot.vc_name}
                            <span className="text-zinc-600">
                              – {getCompanyForVC(slot.vc_name)}
                            </span>
                          </div>
                        </div>
                        {!booked && (
                          <span className="text-emerald-400 text-sm font-medium">
                            Book
                          </span>
                        )}
                      </button>
                    );
                  }
                )}
              </div>
              <button
                type="button"
                className="mt-4 w-full py-2 text-sm text-zinc-500 hover:text-zinc-300"
                onClick={() => {
                  setSelectedHour(null);
                  setSelectedSlot(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedSlot && !showConfirmation && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6">
              <button
                type="button"
                className="mb-4 text-sm text-zinc-500 hover:text-zinc-300 flex items-center"
                onClick={() => setSelectedSlot(null)}
              >
                <span className="mr-1">←</span> Back
              </button>
              <h2 className="text-lg font-medium text-zinc-100 mb-4">
                Book your interview
              </h2>
              <div className="mb-4 p-3 rounded-lg bg-zinc-800 border border-zinc-700">
                <div className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                  <HiOutlineCalendar className="text-zinc-500 shrink-0" />
                  {slotDateString(selectedSlot)}
                </div>
                <div className="text-xs text-zinc-500 flex items-center gap-2 mt-1">
                  <HiOutlineClock className="shrink-0" />
                  {slotTimeString(selectedSlot)}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {selectedSlot.vc_name} – {getCompanyForVC(selectedSlot.vc_name)}
                </div>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleBook();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1.5">
                    <HiOutlineUser className="shrink-0" /> Full name
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-600 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Your name"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1.5">
                    <HiOutlineMail className="shrink-0" /> Email
                  </label>
                  <input
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-600 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    required
                    type="email"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition disabled:opacity-50"
                  disabled={bookSlot.status === "pending"}
                >
                  {bookSlot.status === "pending" ? "Booking…" : "Confirm booking"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showConfirmation && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 text-center">
              <HiOutlineCheckCircle className="text-emerald-500 w-12 h-12 mx-auto mb-4" />
              <h2 className="text-lg font-medium text-zinc-100 mb-1">
                Booking confirmed
              </h2>
              <p className="text-sm text-zinc-400 mb-6">
                Your interview slot has been booked.
              </p>
              <div className="w-full mb-4 p-3 rounded-lg bg-zinc-800 border border-zinc-700 text-left">
                <div className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                  <HiOutlineCalendar className="text-zinc-500 shrink-0" />
                  {confirmedSlot ? slotDateString(confirmedSlot) : ""}
                </div>
                <div className="text-xs text-zinc-500 flex items-center gap-2 mt-1">
                  <HiOutlineClock className="shrink-0" />
                  {confirmedSlot ? slotTimeString(confirmedSlot) : ""}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {confirmedSlot
                    ? `${confirmedSlot.vc_name} – ${getCompanyForVC(confirmedSlot.vc_name)}`
                    : ""}
                </div>
              </div>
              <div className="w-full mb-4 p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/30 text-left">
                <div className="text-xs font-medium text-emerald-300 mb-2">
                  What’s next
                </div>
                <ul className="text-xs text-zinc-400 space-y-1">
                  <li>Check email for the Meet link</li>
                  <li>Add to your calendar</li>
                  <li>Join 3–5 min early</li>
                </ul>
              </div>
              <p className="text-xs text-zinc-500 mb-4">
                Cancel or reschedule? Contact us at least 5 hours before your
                slot.
              </p>
              <button
                type="button"
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"
                onClick={() => setShowConfirmation(false)}
              >
                Done
              </button>
              <p className="mt-4 text-xs text-zinc-500">
                <a
                  href="mailto:microgrants@hackthenorth.com"
                  className="text-emerald-400 hover:text-emerald-300"
                >
                  microgrants@hackthenorth.com
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
