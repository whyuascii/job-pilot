-- Add legal name and preferred name fields to candidates table
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS legal_name VARCHAR(200);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS preferred_name VARCHAR(100);
