import emailjs from "@emailjs/browser";
import { CoffeeChatBooking, CoffeeChatStudent } from "@/hooks/useCoffeeChatInvite";

const emailJsPublicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
const emailJsServiceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
const emailJsCoffeeChatTemplateId =
  process.env.NEXT_PUBLIC_EMAILJS_COFFEE_CHAT_TEMPLATE_ID;
const eventTimeZone = "America/Toronto";

export function hasCoffeeChatEmailConfig() {
  return Boolean(
    emailJsPublicKey && emailJsServiceId && emailJsCoffeeChatTemplateId
  );
}

interface SendCoffeeChatConfirmationEmailArgs {
  student: CoffeeChatStudent;
  booking: CoffeeChatBooking;
  date: string;
  time: string;
  room: string;
  bookingUrl: string;
}

function googleCalendarTimestamp(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: eventTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date(iso))
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

function buildGoogleCalendarUrl({
  booking,
  date,
  time,
  room,
}: Pick<SendCoffeeChatConfirmationEmailArgs, "booking" | "date" | "time" | "room">) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${booking.sponsor_name} Coffee Chat`,
    dates: `${googleCalendarTimestamp(booking.starts_at)}/${googleCalendarTimestamp(
      booking.ends_at
    )}`,
    ctz: eventTimeZone,
    details: [
      `Your Hack the North coffee chat with ${booking.sponsor_name} is confirmed.`,
      "",
      `Time: ${time}`,
      `Date: ${date}`,
      `Location: ${room}`,
      "",
      "If you're lost or unsure where to go, ask an organizer and we'll be happy to point you in the right direction.",
    ].join("\n"),
    location: room,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export async function sendCoffeeChatConfirmationEmail({
  student,
  booking,
  date,
  time,
  room,
  bookingUrl,
}: SendCoffeeChatConfirmationEmailArgs) {
  if (!emailJsPublicKey || !emailJsServiceId || !emailJsCoffeeChatTemplateId) {
    throw new Error("emailjs_not_configured");
  }

  await emailjs.send(
    emailJsServiceId,
    emailJsCoffeeChatTemplateId,
    {
      to_email: student.email,
      to_name: student.full_name,
      student_name: student.full_name,
      sponsor_name: booking.sponsor_name,
      chat_date: date,
      chat_time: time,
      chat_room: room,
      booking_url: bookingUrl,
      google_calendar_url: buildGoogleCalendarUrl({
        booking,
        date,
        time,
        room,
      }),
      event_name: "Hack the North Coffee Chats",
    },
    {
      publicKey: emailJsPublicKey,
    }
  );
}
