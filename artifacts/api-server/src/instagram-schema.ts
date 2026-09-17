import { trainingInstagramSchema } from './instagram-training-schema';

// The outbox is created in the same transaction as the first publication.
// Existing published articles are deliberately excluded from automatic posting.
export const instagramSchema = `
ALTER TABLE managed_articles ADD COLUMN IF NOT EXISTS instagram_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE managed_articles ADD COLUMN IF NOT EXISTS instagram_caption varchar(2200) NOT NULL DEFAULT '';
ALTER TABLE managed_articles ADD COLUMN IF NOT EXISTS first_published boolean NOT NULL DEFAULT false;
UPDATE managed_articles SET first_published = true WHERE status = 'published' AND first_published = false;

CREATE TABLE IF NOT EXISTS instagram_connection (
  id integer PRIMARY KEY CHECK (id = 1),
  user_id text NOT NULL, username text NOT NULL, token_cipher text NOT NULL,
  expires_at timestamptz NOT NULL, refreshed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS instagram_oauth_states (
  state_hash text PRIMARY KEY, browser_hash text NOT NULL, admin_id varchar NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL
);
ALTER TABLE instagram_oauth_states ADD COLUMN IF NOT EXISTS return_to text NOT NULL DEFAULT 'article';
CREATE TABLE IF NOT EXISTS article_instagram_posts (
  article_id integer PRIMARY KEY REFERENCES managed_articles(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  account_id text,
  caption varchar(2200) NOT NULL,
  source_image bytea, image_jpeg bytea,
  image_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','published','failed','review','cancelled')),
  container_id text, publish_attempted boolean NOT NULL DEFAULT false,
  media_id text, permalink text, error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION enqueue_article_instagram() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'published' AND NEW.first_published = false AND NEW.deleted_at IS NULL THEN
    NEW.first_published := true;
    IF NEW.instagram_enabled THEN
      INSERT INTO article_instagram_posts (article_id, account_id, caption, source_image, image_key)
      VALUES (
        NEW.id, (SELECT user_id FROM instagram_connection WHERE id = 1),
        COALESCE(NULLIF(trim(NEW.instagram_caption), ''), NEW.title || E'\\n\\n' || NEW.excerpt),
        (SELECT image_data FROM managed_article_images WHERE article_id = NEW.id
          ORDER BY (placement = 'cover') DESC, sort_order, id LIMIT 1),
        md5(random()::text || clock_timestamp()::text) || md5(random()::text)
      ) ON CONFLICT (article_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS article_instagram_first_publish ON managed_articles;
CREATE TRIGGER article_instagram_first_publish BEFORE INSERT OR UPDATE ON managed_articles
FOR EACH ROW EXECUTE FUNCTION enqueue_article_instagram();
${trainingInstagramSchema}
`;
