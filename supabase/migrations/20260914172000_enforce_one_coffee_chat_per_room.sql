BEGIN;

CREATE TEMP TABLE coffee_chat_room_reassignments ON COMMIT DROP AS
WITH active_bookings AS (
  SELECT
    b.id,
    b.slot_id,
    b.room_id,
    b.created_at,
    row_number() OVER (
      PARTITION BY b.slot_id, b.room_id
      ORDER BY b.created_at, b.id
    ) AS duplicate_rank
  FROM public.coffee_chat_bookings b
  WHERE b.canceled_at IS NULL
),
bookings_to_move AS (
  SELECT
    id AS booking_id,
    slot_id,
    row_number() OVER (
      PARTITION BY slot_id
      ORDER BY created_at, id
    ) AS move_rank
  FROM active_bookings
  WHERE duplicate_rank > 1
),
available_rooms AS (
  SELECT
    slots.slot_id,
    room.id AS room_id,
    row_number() OVER (
      PARTITION BY slots.slot_id
      ORDER BY room.sort_order, room.label
    ) AS room_rank
  FROM (SELECT DISTINCT slot_id FROM bookings_to_move) slots
  JOIN public.coffee_chat_slots slot
    ON slot.id = slots.slot_id
  JOIN public.coffee_chat_rooms room
    ON room.sponsor_id = slot.sponsor_id
    AND room.active
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.coffee_chat_bookings existing
    WHERE existing.slot_id = slots.slot_id
      AND existing.room_id = room.id
      AND existing.canceled_at IS NULL
  )
)
SELECT
  bookings_to_move.booking_id,
  bookings_to_move.slot_id,
  available_rooms.room_id AS new_room_id
FROM bookings_to_move
LEFT JOIN available_rooms
  ON available_rooms.slot_id = bookings_to_move.slot_id
  AND available_rooms.room_rank = bookings_to_move.move_rank;

DO $$
DECLARE
  v_unassigned_count INTEGER;
  v_duplicate_count INTEGER;
BEGIN
  SELECT count(*)::INTEGER
  INTO v_unassigned_count
  FROM coffee_chat_room_reassignments
  WHERE new_room_id IS NULL;

  IF v_unassigned_count > 0 THEN
    RAISE EXCEPTION 'cannot_reassign_existing_duplicate_room_bookings';
  END IF;

  UPDATE public.coffee_chat_bookings booking
  SET room_id = reassignment.new_room_id
  FROM coffee_chat_room_reassignments reassignment
  WHERE booking.id = reassignment.booking_id;

  SELECT count(*)::INTEGER
  INTO v_duplicate_count
  FROM (
    SELECT slot_id, room_id
    FROM public.coffee_chat_bookings
    WHERE canceled_at IS NULL
    GROUP BY slot_id, room_id
    HAVING count(*) > 1
  ) duplicates;

  IF v_duplicate_count > 0 THEN
    RAISE EXCEPTION 'duplicate_room_bookings_remain';
  END IF;
END;
$$;

WITH room_counts AS (
  SELECT sponsor_id, count(*)::INTEGER AS room_count
  FROM public.coffee_chat_rooms
  WHERE active
  GROUP BY sponsor_id
)
UPDATE public.coffee_chat_sponsors sponsor
SET hackers_per_slot = room_counts.room_count
FROM room_counts
WHERE sponsor.id = room_counts.sponsor_id
  AND sponsor.hackers_per_slot <> room_counts.room_count;

CREATE UNIQUE INDEX IF NOT EXISTS coffee_chat_one_active_booking_per_slot_room
  ON public.coffee_chat_bookings (slot_id, room_id)
  WHERE canceled_at IS NULL;

COMMIT;
