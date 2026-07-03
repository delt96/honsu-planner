-- 방별 실측: 천장 높이(방마다 다를 수 있음) + 벽 부착물(문·창문·콘센트).
-- 부착물은 벽 앵커 방식: 어느 벽(N/E/S/W) + 그 벽 시작 모서리에서 거리(cm).
-- offset 0점 규약 — N/S 벽: 서쪽(왼쪽) 모서리, E/W 벽: 북쪽(위) 모서리.
ALTER TABLE rooms ADD COLUMN ceiling_height_cm numeric;

CREATE TABLE room_features (
  id serial PRIMARY KEY,
  room_id int NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  kind text NOT NULL,
  wall text NOT NULL,
  offset_cm numeric NOT NULL,
  width_cm numeric,
  height_cm numeric,
  sill_height_cm numeric,
  floor_height_cm numeric,
  swing text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_room_features_room ON room_features(room_id);
