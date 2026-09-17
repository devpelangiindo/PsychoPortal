export const trainingInstagramSchema = `
ALTER TABLE trainings ADD COLUMN IF NOT EXISTS instagram_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE trainings ADD COLUMN IF NOT EXISTS instagram_caption varchar(2200) NOT NULL DEFAULT '';
ALTER TABLE trainings ADD COLUMN IF NOT EXISTS first_published boolean NOT NULL DEFAULT false;
UPDATE trainings SET first_published=true WHERE status IN ('published','closed','completed') AND NOT first_published;

CREATE TABLE IF NOT EXISTS training_instagram_posts (
  training_id integer PRIMARY KEY REFERENCES trainings(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  account_id text, caption varchar(2200) NOT NULL,
  source_image bytea, image_jpeg bytea, image_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','published','failed','review','cancelled')),
  container_id text, publish_attempted boolean NOT NULL DEFAULT false,
  media_id text, permalink text, error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

-- Training date columns follow the existing application's UTC timestamp storage.
CREATE OR REPLACE FUNCTION training_instagram_caption(t trainings) RETURNS text AS $$
  SELECT COALESCE(NULLIF(trim(t.instagram_caption), ''), concat_ws(E'\\n\\n',
    trim(t.title), trim(t.summary),
    CASE WHEN t.starts_at IS NOT NULL THEN 'Mulai: ' || to_char(t.starts_at + interval '7 hours', 'DD/MM/YYYY HH24:MI') || ' WIB' END,
    CASE WHEN t.ends_at IS NOT NULL THEN 'Selesai: ' || to_char(t.ends_at + interval '7 hours', 'DD/MM/YYYY HH24:MI') || ' WIB' END,
    CASE WHEN NULLIF(trim(t.location),'') IS NOT NULL THEN 'Lokasi/media: ' || trim(t.location) END,
    CASE WHEN t.registration_deadline IS NOT NULL THEN 'Batas pendaftaran: ' || to_char(t.registration_deadline + interval '7 hours', 'DD/MM/YYYY HH24:MI') || ' WIB' END,
    'Informasi dan pendaftaran: kunjungi halaman Pelatihan di website Pelangi Indonesia.'
  ));
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION training_instagram_eligible(t trainings) RETURNS boolean AS $$
  SELECT t.status='published' AND t.deleted_at IS NULL AND t.instagram_enabled
    AND (COALESCE(t.ends_at,t.starts_at) IS NULL OR COALESCE(t.ends_at,t.starts_at) > (now() AT TIME ZONE 'UTC'))
    AND (t.registration_deadline IS NULL OR t.registration_deadline > (now() AT TIME ZONE 'UTC'));
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION enqueue_training_instagram() RETURNS trigger AS $$
BEGIN
  IF NEW.status='published' AND NOT NEW.first_published AND NEW.deleted_at IS NULL THEN
    NEW.first_published := true;
    IF NEW.instagram_enabled THEN
      INSERT INTO training_instagram_posts(training_id,account_id,caption,source_image,image_key,status,error)
      VALUES (NEW.id, (SELECT user_id FROM instagram_connection WHERE id=1), training_instagram_caption(NEW),
        (SELECT image_data FROM training_posters WHERE training_id=NEW.id),
        replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),
        CASE WHEN training_instagram_eligible(NEW) THEN 'pending' ELSE 'cancelled' END,
        CASE WHEN training_instagram_eligible(NEW) THEN NULL ELSE 'Pelatihan sudah selesai atau pendaftaran ditutup.' END
      ) ON CONFLICT (training_id) DO NOTHING;
    END IF;
  END IF;
  IF NOT training_instagram_eligible(NEW) THEN
    UPDATE training_instagram_posts SET status='cancelled',error='Pelatihan tidak lagi aktif atau opsi Instagram dinonaktifkan.',updated_at=now()
    WHERE training_id=NEW.id AND status IN ('pending','processing') AND NOT publish_attempted;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS training_instagram_first_publish ON trainings;
CREATE TRIGGER training_instagram_first_publish BEFORE INSERT OR UPDATE ON trainings
FOR EACH ROW EXECUTE FUNCTION enqueue_training_instagram();
`;
