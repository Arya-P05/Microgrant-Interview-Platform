SELECT
  sponsor_name,
  starts_at AT TIME ZONE 'America/Toronto' AS starts_at_toronto,
  ends_at AT TIME ZONE 'America/Toronto' AS ends_at_toronto,
  slot_minutes,
  hackers_per_slot,
  room_display_label,
  room_label,
  room_name,
  location_label,
  student_name,
  student_email
FROM public.coffee_chat_schedule_export
WHERE canceled_at IS NULL
ORDER BY sponsor_sort_order, sponsor_name, starts_at_toronto, room_label, student_name;
