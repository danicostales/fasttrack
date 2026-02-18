CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- junction: which judges are in which room
CREATE TABLE room_judges (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (room_id, judge_id)
);

-- junction: which challenges are assigned to which room
CREATE TABLE room_challenges (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  PRIMARY KEY (room_id, challenge_id)
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_judges ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_challenges ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Authenticated users can read rooms"
  ON rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read room_judges"
  ON room_judges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read room_challenges"
  ON room_challenges FOR SELECT TO authenticated USING (true);

-- Admins can write
CREATE POLICY "Admins can insert rooms"
  ON rooms FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update rooms"
  ON rooms FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can delete rooms"
  ON rooms FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert room_judges"
  ON room_judges FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can delete room_judges"
  ON room_judges FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert room_challenges"
  ON room_challenges FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can delete room_challenges"
  ON room_challenges FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
