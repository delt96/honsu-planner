-- Single-row table holding our home's carry-in constraints (현관·엘리베이터 치수).
-- All dimensions are nullable — the user fills in only what they know, and any
-- unspecified constraint is skipped when judging carry-in feasibility.
CREATE TABLE home_settings (
  id int PRIMARY KEY,
  door_width_cm numeric,
  door_height_cm numeric,
  elevator_door_width_cm numeric,
  elevator_door_height_cm numeric,
  elevator_car_width_cm numeric,
  elevator_car_depth_cm numeric,
  elevator_car_height_cm numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO home_settings (id) VALUES (1);
