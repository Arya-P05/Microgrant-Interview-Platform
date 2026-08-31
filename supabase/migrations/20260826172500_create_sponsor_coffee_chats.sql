CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS public.coffee_chat_sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  contact_email CITEXT,
  location_label TEXT,
  slot_minutes INTEGER NOT NULL CHECK (slot_minutes > 0),
  hackers_per_slot INTEGER NOT NULL CHECK (hackers_per_slot > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coffee_chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES public.coffee_chat_sponsors(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  room_name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sponsor_id, label)
);

CREATE TABLE IF NOT EXISTS public.coffee_chat_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email CITEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coffee_chat_shortlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.coffee_chat_students(id) ON DELETE CASCADE,
  sponsor_id UUID NOT NULL REFERENCES public.coffee_chat_sponsors(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'held', 'removed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, sponsor_id)
);

CREATE TABLE IF NOT EXISTS public.coffee_chat_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.coffee_chat_students(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coffee_chat_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES public.coffee_chat_sponsors(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  UNIQUE (sponsor_id, starts_at, ends_at)
);

CREATE TABLE IF NOT EXISTS public.coffee_chat_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES public.coffee_chat_invites(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES public.coffee_chat_students(id) ON DELETE CASCADE,
  sponsor_id UUID NOT NULL REFERENCES public.coffee_chat_sponsors(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES public.coffee_chat_slots(id) ON DELETE RESTRICT,
  room_id UUID NOT NULL REFERENCES public.coffee_chat_rooms(id) ON DELETE RESTRICT,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS coffee_chat_one_active_booking_per_student_sponsor
  ON public.coffee_chat_bookings (student_id, sponsor_id)
  WHERE canceled_at IS NULL;

CREATE INDEX IF NOT EXISTS coffee_chat_bookings_slot_room_active
  ON public.coffee_chat_bookings (slot_id, room_id)
  WHERE canceled_at IS NULL;

CREATE INDEX IF NOT EXISTS coffee_chat_rooms_sponsor
  ON public.coffee_chat_rooms (sponsor_id, active, sort_order);

CREATE INDEX IF NOT EXISTS coffee_chat_slots_sponsor_starts_at
  ON public.coffee_chat_slots (sponsor_id, starts_at);

CREATE INDEX IF NOT EXISTS coffee_chat_shortlists_student
  ON public.coffee_chat_shortlists (student_id, sponsor_id)
  WHERE status = 'invited';

CREATE INDEX IF NOT EXISTS coffee_chat_bookings_student_active
  ON public.coffee_chat_bookings (student_id, canceled_at);

ALTER TABLE public.coffee_chat_sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coffee_chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coffee_chat_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coffee_chat_shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coffee_chat_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coffee_chat_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coffee_chat_bookings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.coffee_chat_sponsors FROM anon, authenticated;
REVOKE ALL ON TABLE public.coffee_chat_rooms FROM anon, authenticated;
REVOKE ALL ON TABLE public.coffee_chat_students FROM anon, authenticated;
REVOKE ALL ON TABLE public.coffee_chat_shortlists FROM anon, authenticated;
REVOKE ALL ON TABLE public.coffee_chat_invites FROM anon, authenticated;
REVOKE ALL ON TABLE public.coffee_chat_slots FROM anon, authenticated;
REVOKE ALL ON TABLE public.coffee_chat_bookings FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.coffee_chat_token_hash(p_token TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(extensions.digest(trim(p_token), 'sha256'), 'hex');
$$;

REVOKE ALL ON FUNCTION public.coffee_chat_token_hash(TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_coffee_chat_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.coffee_chat_invites%ROWTYPE;
  v_student public.coffee_chat_students%ROWTYPE;
  v_sponsors JSONB;
  v_existing_bookings JSONB;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 24 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_link');
  END IF;

  SELECT *
  INTO v_invite
  FROM public.coffee_chat_invites
  WHERE token_hash = public.coffee_chat_token_hash(p_token)
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_link');
  END IF;

  SELECT *
  INTO v_student
  FROM public.coffee_chat_students
  WHERE id = v_invite.student_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'sponsor_id', sp.id,
        'sponsor_name', sp.name,
        'slot_id', sl.id,
        'room_id', room.id,
        'room_label', room.label,
        'room_name', room.room_name,
        'starts_at', sl.starts_at,
        'ends_at', sl.ends_at,
        'location_label', sp.location_label,
        'created_at', b.created_at
      )
      ORDER BY sl.starts_at, sp.name
    ),
    '[]'::jsonb
  )
  INTO v_existing_bookings
  FROM public.coffee_chat_bookings b
  JOIN public.coffee_chat_slots sl ON sl.id = b.slot_id
  JOIN public.coffee_chat_sponsors sp ON sp.id = b.sponsor_id
  JOIN public.coffee_chat_rooms room ON room.id = b.room_id
  WHERE b.student_id = v_student.id
    AND b.canceled_at IS NULL;

  WITH eligible_sponsors AS (
    SELECT
      sp.id,
      sp.name,
      sp.slug,
      sp.location_label,
      sp.slot_minutes,
      sp.hackers_per_slot,
      sp.sort_order,
      ss.notes
    FROM public.coffee_chat_shortlists ss
    JOIN public.coffee_chat_sponsors sp ON sp.id = ss.sponsor_id
    WHERE ss.student_id = v_student.id
      AND ss.status = 'invited'
  ),
  room_counts AS (
    SELECT sponsor_id, count(*)::INTEGER AS room_count
    FROM public.coffee_chat_rooms
    WHERE active
    GROUP BY sponsor_id
  ),
  slots_with_counts AS (
    SELECT
      sl.id,
      sl.sponsor_id,
      sl.starts_at,
      sl.ends_at,
      es.slot_minutes,
      es.hackers_per_slot AS capacity,
      COALESCE(rc.room_count, 0)::INTEGER AS room_count,
      count(b.id)::INTEGER AS booked_count
    FROM public.coffee_chat_slots sl
    JOIN eligible_sponsors es ON es.id = sl.sponsor_id
    LEFT JOIN room_counts rc ON rc.sponsor_id = sl.sponsor_id
    LEFT JOIN public.coffee_chat_bookings b
      ON b.slot_id = sl.id
      AND b.canceled_at IS NULL
    WHERE sl.starts_at > now()
      AND COALESCE(rc.room_count, 0) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM public.coffee_chat_bookings existing
        WHERE existing.student_id = v_student.id
          AND existing.sponsor_id = sl.sponsor_id
          AND existing.canceled_at IS NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.coffee_chat_bookings existing
        JOIN public.coffee_chat_slots existing_slot
          ON existing_slot.id = existing.slot_id
        WHERE existing.student_id = v_student.id
          AND existing.canceled_at IS NULL
          AND existing_slot.starts_at < sl.ends_at
          AND sl.starts_at < existing_slot.ends_at
      )
    GROUP BY sl.id, es.slot_minutes, es.hackers_per_slot, rc.room_count
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', es.id,
        'name', es.name,
        'slug', es.slug,
        'notes', es.notes,
        'location_label', es.location_label,
        'room_labels', COALESCE(
          (
            SELECT jsonb_agg(room.label ORDER BY room.sort_order, room.label)
            FROM public.coffee_chat_rooms room
            WHERE room.sponsor_id = es.id
              AND room.active
          ),
          '[]'::jsonb
        ),
        'rooms', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', room.id,
                'label', room.label,
                'room_name', room.room_name
              )
              ORDER BY room.sort_order, room.label
            )
            FROM public.coffee_chat_rooms room
            WHERE room.sponsor_id = es.id
              AND room.active
          ),
          '[]'::jsonb
        ),
        'slot_minutes', es.slot_minutes,
        'hackers_per_slot', es.hackers_per_slot,
        'slots', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', swc.id,
                'starts_at', swc.starts_at,
                'ends_at', swc.ends_at,
                'location_label', es.location_label,
                'slot_minutes', swc.slot_minutes,
                'room_count', swc.room_count,
                'capacity', swc.capacity,
                'booked_count', swc.booked_count,
                'available_count', greatest(swc.capacity - swc.booked_count, 0),
                'is_full', swc.booked_count >= swc.capacity
              )
              ORDER BY swc.starts_at
            )
            FROM slots_with_counts swc
            WHERE swc.sponsor_id = es.id
          ),
          '[]'::jsonb
        )
      )
      ORDER BY es.sort_order, es.name
    ),
    '[]'::jsonb
  )
  INTO v_sponsors
  FROM eligible_sponsors es;

  RETURN jsonb_build_object(
    'valid', true,
    'student', jsonb_build_object(
      'id', v_student.id,
      'full_name', v_student.full_name,
      'email', v_student.email
    ),
    'expires_at', v_invite.expires_at,
    'requires_email_verification', false,
    'rules', jsonb_build_object(
      'booking_limit', 'one_per_sponsor',
      'overlaps', 'blocked',
      'room_assignment', 'random_available_room'
    ),
    'existing_bookings', v_existing_bookings,
    'sponsors', v_sponsors
  );
END;
$$;

DROP FUNCTION IF EXISTS public.book_coffee_chat_slot(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.book_coffee_chat_slot(
  p_token TEXT,
  p_slot_id UUID,
  p_room_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.coffee_chat_invites%ROWTYPE;
  v_student public.coffee_chat_students%ROWTYPE;
  v_slot public.coffee_chat_slots%ROWTYPE;
  v_sponsor public.coffee_chat_sponsors%ROWTYPE;
  v_room public.coffee_chat_rooms%ROWTYPE;
  v_booking public.coffee_chat_bookings%ROWTYPE;
  v_booked_count INTEGER;
  v_room_count INTEGER;
  v_room_capacity INTEGER;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 24 THEN
    RAISE EXCEPTION 'invalid_invite';
  END IF;

  SELECT *
  INTO v_invite
  FROM public.coffee_chat_invites
  WHERE token_hash = public.coffee_chat_token_hash(p_token)
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_invite';
  END IF;

  SELECT *
  INTO v_student
  FROM public.coffee_chat_students
  WHERE id = v_invite.student_id;

  SELECT *
  INTO v_slot
  FROM public.coffee_chat_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'slot_not_found';
  END IF;

  IF v_slot.starts_at <= now() THEN
    RAISE EXCEPTION 'slot_closed';
  END IF;

  SELECT *
  INTO v_sponsor
  FROM public.coffee_chat_sponsors
  WHERE id = v_slot.sponsor_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.coffee_chat_shortlists ss
    WHERE ss.student_id = v_student.id
      AND ss.sponsor_id = v_slot.sponsor_id
      AND ss.status = 'invited'
  ) THEN
    RAISE EXCEPTION 'not_eligible_for_sponsor';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.coffee_chat_bookings b
    WHERE b.student_id = v_student.id
      AND b.sponsor_id = v_slot.sponsor_id
      AND b.canceled_at IS NULL
  ) THEN
    RAISE EXCEPTION 'already_booked_for_sponsor';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.coffee_chat_bookings b
    JOIN public.coffee_chat_slots booked_slot
      ON booked_slot.id = b.slot_id
    WHERE b.student_id = v_student.id
      AND b.canceled_at IS NULL
      AND booked_slot.starts_at < v_slot.ends_at
      AND v_slot.starts_at < booked_slot.ends_at
  ) THEN
    RAISE EXCEPTION 'slot_overlaps_existing_booking';
  END IF;

  SELECT count(*)::INTEGER
  INTO v_booked_count
  FROM public.coffee_chat_bookings b
  WHERE b.slot_id = v_slot.id
    AND b.canceled_at IS NULL;

  IF v_booked_count >= v_sponsor.hackers_per_slot THEN
    RAISE EXCEPTION 'slot_full';
  END IF;

  SELECT count(*)::INTEGER
  INTO v_room_count
  FROM public.coffee_chat_rooms room
  WHERE room.sponsor_id = v_slot.sponsor_id
    AND room.active;

  IF v_room_count = 0 THEN
    RAISE EXCEPTION 'slot_full';
  END IF;

  v_room_capacity := ceil(v_sponsor.hackers_per_slot::NUMERIC / v_room_count::NUMERIC)::INTEGER;

  IF p_room_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.coffee_chat_rooms room
      WHERE room.id = p_room_id
        AND room.sponsor_id = v_slot.sponsor_id
        AND room.active
    ) THEN
      RAISE EXCEPTION 'invalid_room';
    END IF;

    SELECT *
    INTO v_room
    FROM public.coffee_chat_rooms room
    WHERE room.id = p_room_id
      AND (
        SELECT count(*)::INTEGER
        FROM public.coffee_chat_bookings b
        WHERE b.slot_id = v_slot.id
          AND b.room_id = room.id
          AND b.canceled_at IS NULL
      ) < v_room_capacity
    FOR UPDATE;
  END IF;

  IF v_room.id IS NULL THEN
    SELECT *
    INTO v_room
    FROM public.coffee_chat_rooms room
    WHERE room.sponsor_id = v_slot.sponsor_id
      AND room.active
      AND (
        SELECT count(*)::INTEGER
        FROM public.coffee_chat_bookings b
        WHERE b.slot_id = v_slot.id
          AND b.room_id = room.id
          AND b.canceled_at IS NULL
      ) < v_room_capacity
    ORDER BY (
      SELECT count(*)::INTEGER
      FROM public.coffee_chat_bookings b
      WHERE b.slot_id = v_slot.id
        AND b.room_id = room.id
        AND b.canceled_at IS NULL
    ), random()
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'slot_full';
  END IF;

  INSERT INTO public.coffee_chat_bookings (
    invite_id,
    student_id,
    sponsor_id,
    slot_id,
    room_id
  )
  VALUES (
    v_invite.id,
    v_student.id,
    v_slot.sponsor_id,
    v_slot.id,
    v_room.id
  )
  RETURNING *
  INTO v_booking;

  RETURN (
    SELECT jsonb_build_object(
      'status', 'booked',
      'booking', jsonb_build_object(
        'id', v_booking.id,
        'sponsor_id', sp.id,
        'sponsor_name', sp.name,
        'slot_id', v_slot.id,
        'room_id', v_room.id,
        'room_label', v_room.label,
        'room_name', v_room.room_name,
        'starts_at', v_slot.starts_at,
        'ends_at', v_slot.ends_at,
        'location_label', sp.location_label,
        'slot_minutes', sp.slot_minutes,
        'created_at', v_booking.created_at
      )
    )
    FROM public.coffee_chat_sponsors sp
    WHERE sp.id = v_slot.sponsor_id
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'booking_conflict_retry';
END;
$$;

CREATE OR REPLACE VIEW public.coffee_chat_schedule_export AS
SELECT
  sp.name AS sponsor_name,
  sp.sort_order AS sponsor_sort_order,
  st.full_name AS student_name,
  st.email AS student_email,
  sl.starts_at,
  sl.ends_at,
  sp.slot_minutes,
  sp.hackers_per_slot,
  sp.location_label,
  room.label AS room_label,
  room.room_name,
  CASE
    WHEN room.room_name IS NULL THEN room.label
    ELSE room.label || ' (' || room.room_name || ')'
  END AS room_display_label,
  b.created_at AS booked_at,
  b.canceled_at
FROM public.coffee_chat_bookings b
JOIN public.coffee_chat_students st ON st.id = b.student_id
JOIN public.coffee_chat_sponsors sp ON sp.id = b.sponsor_id
JOIN public.coffee_chat_slots sl ON sl.id = b.slot_id
JOIN public.coffee_chat_rooms room ON room.id = b.room_id
ORDER BY sp.sort_order, sp.name, sl.starts_at, room.sort_order, st.full_name;

REVOKE ALL ON public.coffee_chat_schedule_export FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_coffee_chat_invite(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_coffee_chat_slot(TEXT, UUID, UUID) TO anon, authenticated;
