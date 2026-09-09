-- Read state belongs to the signed-in user, never to the whole department.
CREATE TABLE notification_reads (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_item_id UUID NOT NULL REFERENCES business_items(id) ON DELETE CASCADE,
  due_at TIMESTAMPTZ NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, business_item_id)
);
