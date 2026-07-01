CREATE TABLE items (
  id serial PRIMARY KEY,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  confirmed_candidate_id int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE candidates (
  id serial PRIMARY KEY,
  item_id int NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  name text NOT NULL,
  price bigint,
  url text,
  memo text,
  width_cm numeric,
  depth_cm numeric,
  height_cm numeric,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_candidates_item ON candidates(item_id);
