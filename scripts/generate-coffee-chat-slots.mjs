#!/usr/bin/env node

import schedule from "../data/sponsorCoffeeChatWindows.json" with { type: "json" };

const eventDate =
  process.argv[2] || process.env.COFFEE_CHAT_SATURDAY || schedule.eventDate;
const timeZone =
  process.argv[3] || process.env.COFFEE_CHAT_TIME_ZONE || schedule.timeZone;
if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
  console.error("Usage: node scripts/generate-coffee-chat-slots.mjs YYYY-MM-DD [America/Toronto]");
  console.error("Example: node scripts/generate-coffee-chat-slots.mjs 2026-09-19");
  process.exit(1);
}

function sql(value) {
  return String(value).replaceAll("'", "''");
}

function minutes(time) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function clock(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function roomLabel(room) {
  return typeof room === "string" ? room : room.label;
}

function roomName(room) {
  return typeof room === "string" ? null : room.roomName;
}

console.log(`-- Generated sponsor coffee-chat slots for ${eventDate} (${timeZone})`);
console.log("-- Slot windows are end-exclusive: 09:00-10:00 creates slots that start before 10:00.");
console.log("");
console.log("BEGIN;");
console.log("");

for (const [sponsorIndex, sponsor] of schedule.sponsors.entries()) {
  const sponsorSlotMinutes = Number(sponsor.slotMinutes || schedule.slotMinutes);
  const hackersPerSlot = Number(sponsor.hackersPerSlot || sponsor.rooms.length);

  console.log(
    "INSERT INTO public.coffee_chat_sponsors (name, slug, location_label, slot_minutes, hackers_per_slot, sort_order)"
  );
  console.log(
    `VALUES ('${sql(sponsor.name)}', '${sql(sponsor.slug)}', '${sql(sponsor.locationLabel)}', ${sponsorSlotMinutes}, ${hackersPerSlot}, ${sponsorIndex + 1})`
  );
  console.log("ON CONFLICT (slug) DO UPDATE");
  console.log("SET");
  console.log("  name = EXCLUDED.name,");
  console.log("  location_label = EXCLUDED.location_label,");
  console.log("  slot_minutes = EXCLUDED.slot_minutes,");
  console.log("  hackers_per_slot = EXCLUDED.hackers_per_slot,");
  console.log("  sort_order = EXCLUDED.sort_order;");
  console.log("");

  for (const [index, room] of sponsor.rooms.entries()) {
    console.log("INSERT INTO public.coffee_chat_rooms (sponsor_id, label, room_name, sort_order, active)");
    console.log("SELECT id,");
    console.log(`  '${sql(roomLabel(room))}',`);
    console.log(
      `  ${roomName(room) ? `'${sql(roomName(room))}'` : "NULL"},`
    );
    console.log(`  ${index + 1},`);
    console.log("  true");
    console.log("FROM public.coffee_chat_sponsors");
    console.log(`WHERE slug = '${sql(sponsor.slug)}'`);
    console.log("ON CONFLICT (sponsor_id, label) DO UPDATE");
    console.log("SET room_name = EXCLUDED.room_name, sort_order = EXCLUDED.sort_order, active = true;");
    console.log("");
  }
}

for (const sponsor of schedule.sponsors) {
  const start = minutes(sponsor.startTime);
  const end = minutes(sponsor.endTime);
  const sponsorSlotMinutes = Number(sponsor.slotMinutes || schedule.slotMinutes);

  for (
    let current = start;
    current + sponsorSlotMinutes <= end;
    current += sponsorSlotMinutes
  ) {
    const startsAt = `${eventDate} ${clock(current)}:00 ${timeZone}`;
    const endsAt = `${eventDate} ${clock(current + sponsorSlotMinutes)}:00 ${timeZone}`;

    console.log("INSERT INTO public.coffee_chat_slots (sponsor_id, starts_at, ends_at)");
    console.log("SELECT id,");
    console.log(`  '${sql(startsAt)}'::timestamptz,`);
    console.log(`  '${sql(endsAt)}'::timestamptz`);
    console.log("FROM public.coffee_chat_sponsors");
    console.log(`WHERE slug = '${sql(sponsor.slug)}'`);
    console.log("ON CONFLICT (sponsor_id, starts_at, ends_at)");
    console.log("DO NOTHING;");
    console.log("");
  }
}

console.log("COMMIT;");
