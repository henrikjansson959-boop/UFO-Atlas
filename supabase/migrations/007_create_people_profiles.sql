-- Public people profiles and their reviewed archive relationships.
-- Profiles are private until an editor explicitly sets is_published = true.

CREATE TABLE IF NOT EXISTS People_Profiles (
  person_id BIGSERIAL PRIMARY KEY,
  slug VARCHAR(180) NOT NULL UNIQUE,
  full_name VARCHAR(240) NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  role VARCHAR(160) NOT NULL,
  birth_year INTEGER,
  death_year INTEGER,
  photo_url TEXT,
  biography TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT people_profiles_year_order
    CHECK (birth_year IS NULL OR death_year IS NULL OR death_year >= birth_year)
);

CREATE TABLE IF NOT EXISTS Person_Content_Links (
  person_id BIGINT NOT NULL REFERENCES People_Profiles(person_id) ON DELETE CASCADE,
  content_id INTEGER NOT NULL REFERENCES Timeline_Archive(content_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (person_id, content_id)
);

CREATE TABLE IF NOT EXISTS UFO_Cases (
  case_id BIGSERIAL PRIMARY KEY,
  slug VARCHAR(180) NOT NULL UNIQUE,
  title VARCHAR(300) NOT NULL,
  summary TEXT,
  event_date DATE,
  location VARCHAR(300),
  case_status VARCHAR(80) NOT NULL DEFAULT 'Documented',
  cover_image_url TEXT,
  source_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS Case_Content_Links (
  case_id BIGINT NOT NULL REFERENCES UFO_Cases(case_id) ON DELETE CASCADE,
  content_id INTEGER NOT NULL REFERENCES Timeline_Archive(content_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (case_id, content_id)
);

CREATE TABLE IF NOT EXISTS Person_Case_Links (
  person_id BIGINT NOT NULL REFERENCES People_Profiles(person_id) ON DELETE CASCADE,
  case_id BIGINT NOT NULL REFERENCES UFO_Cases(case_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (person_id, case_id)
);

CREATE TABLE IF NOT EXISTS Person_Sources (
  source_id BIGSERIAL PRIMARY KEY,
  person_id BIGINT NOT NULL REFERENCES People_Profiles(person_id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  publisher VARCHAR(240),
  published_at DATE,
  source_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_people_profiles_published_name
  ON People_Profiles(is_published, full_name);
CREATE INDEX IF NOT EXISTS idx_person_content_links_content
  ON Person_Content_Links(content_id);
CREATE INDEX IF NOT EXISTS idx_ufo_cases_published_title
  ON UFO_Cases(is_published, title);
CREATE INDEX IF NOT EXISTS idx_case_content_links_content
  ON Case_Content_Links(content_id);
CREATE INDEX IF NOT EXISTS idx_person_case_links_case
  ON Person_Case_Links(case_id);
CREATE INDEX IF NOT EXISTS idx_person_sources_person
  ON Person_Sources(person_id);

ALTER TABLE People_Profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE Person_Content_Links ENABLE ROW LEVEL SECURITY;
ALTER TABLE UFO_Cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE Case_Content_Links ENABLE ROW LEVEL SECURITY;
ALTER TABLE Person_Case_Links ENABLE ROW LEVEL SECURITY;
ALTER TABLE Person_Sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published people are public" ON People_Profiles;
CREATE POLICY "Published people are public"
  ON People_Profiles FOR SELECT
  TO anon, authenticated
  USING (is_published = TRUE);

DROP POLICY IF EXISTS "Published people content links are public" ON Person_Content_Links;
CREATE POLICY "Published people content links are public"
  ON Person_Content_Links FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM People_Profiles
      WHERE People_Profiles.person_id = Person_Content_Links.person_id
        AND People_Profiles.is_published = TRUE
    )
  );

DROP POLICY IF EXISTS "Published cases are public" ON UFO_Cases;
CREATE POLICY "Published cases are public"
  ON UFO_Cases FOR SELECT
  TO anon, authenticated
  USING (is_published = TRUE);

DROP POLICY IF EXISTS "Published case content links are public" ON Case_Content_Links;
CREATE POLICY "Published case content links are public"
  ON Case_Content_Links FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM UFO_Cases
      WHERE UFO_Cases.case_id = Case_Content_Links.case_id
        AND UFO_Cases.is_published = TRUE
    )
  );

DROP POLICY IF EXISTS "Published people case links are public" ON Person_Case_Links;
CREATE POLICY "Published people case links are public"
  ON Person_Case_Links FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM People_Profiles
      WHERE People_Profiles.person_id = Person_Case_Links.person_id
        AND People_Profiles.is_published = TRUE
    )
    AND EXISTS (
      SELECT 1
      FROM UFO_Cases
      WHERE UFO_Cases.case_id = Person_Case_Links.case_id
        AND UFO_Cases.is_published = TRUE
    )
  );

DROP POLICY IF EXISTS "Published people sources are public" ON Person_Sources;
CREATE POLICY "Published people sources are public"
  ON Person_Sources FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM People_Profiles
      WHERE People_Profiles.person_id = Person_Sources.person_id
        AND People_Profiles.is_published = TRUE
    )
  );

GRANT SELECT ON People_Profiles TO anon, authenticated;
GRANT SELECT ON Person_Content_Links TO anon, authenticated;
GRANT SELECT ON UFO_Cases TO anon, authenticated;
GRANT SELECT ON Case_Content_Links TO anon, authenticated;
GRANT SELECT ON Person_Case_Links TO anon, authenticated;
GRANT SELECT ON Person_Sources TO anon, authenticated;

COMMENT ON TABLE People_Profiles IS 'Reviewed profiles for UFO-related people; unpublished by default.';
COMMENT ON TABLE Person_Content_Links IS 'Approved archive content associated with a reviewed person profile.';
COMMENT ON TABLE UFO_Cases IS 'Reviewed UFO cases that can be associated with people.';
COMMENT ON TABLE Case_Content_Links IS 'Approved archive materials collected under a reviewed UFO case.';
COMMENT ON TABLE Person_Case_Links IS 'Many-to-many relationship between people profiles and UFO cases.';
COMMENT ON TABLE Person_Sources IS 'Editorial sources supporting facts shown on a person profile.';
