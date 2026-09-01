import emailjs from "@emailjs/browser";
import { CoffeeChatBooking, CoffeeChatStudent } from "@/hooks/useCoffeeChatInvite";

const emailJsPublicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
const emailJsServiceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
const emailJsCoffeeChatTemplateId =
  process.env.NEXT_PUBLIC_EMAILJS_COFFEE_CHAT_TEMPLATE_ID;

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
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function buildGoogleCalendarUrl({
  booking,
  room,
  bookingUrl,
}: Pick<SendCoffeeChatConfirmationEmailArgs, "booking" | "room" | "bookingUrl">) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Hack the North Coffee Chat with ${booking.sponsor_name}`,
    dates: `${googleCalendarTimestamp(booking.starts_at)}/${googleCalendarTimestamp(
      booking.ends_at
    )}`,
    details: `Your Hack the North sponsor coffee chat is confirmed.\n\nPrivate invite: ${bookingUrl}`,
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
        room,
        bookingUrl,
      }),
      event_name: "Hack the North Coffee Chats",
    },
    {
      publicKey: emailJsPublicKey,
    }
  );
}
