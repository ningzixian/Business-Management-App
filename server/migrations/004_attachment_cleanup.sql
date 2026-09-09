-- Durable object-cleanup outbox. Additive; keep it when rolling back application images.
CREATE TABLE attachment_cleanup_jobs (
  object_key VARCHAR(600) PRIMARY KEY,
  due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX attachment_cleanup_jobs_due_idx ON attachment_cleanup_jobs(due_at);

CREATE FUNCTION queue_deleted_item_attachments() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    INSERT INTO attachment_cleanup_jobs(object_key)
      SELECT object_key FROM attachments WHERE business_item_id = NEW.id AND status = 'active'
      ON CONFLICT DO NOTHING;
    UPDATE attachments SET status = 'deleted', deleted_at = NOW()
      WHERE business_item_id = NEW.id AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER business_items_cleanup_attachments AFTER UPDATE OF deleted_at ON business_items
  FOR EACH ROW EXECUTE FUNCTION queue_deleted_item_attachments();
