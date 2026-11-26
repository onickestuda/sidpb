-- Retired: historical identities must never be reassociated after deletion.
DO $$ BEGIN RAISE EXCEPTION 'Historical account reassociation is disabled. Register a new identity.'; END $$;
