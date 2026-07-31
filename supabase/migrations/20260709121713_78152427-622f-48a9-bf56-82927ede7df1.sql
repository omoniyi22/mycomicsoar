ALTER TABLE public.comics ADD COLUMN IF NOT EXISTS price_eur NUMERIC(10,2);

-- Support guest orders: allow email-scoped orders without a user_id, and add flutterwave provider
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT false;

-- Allow anon to insert/select their own guest orders by reference (checked in server code)
-- We keep RLS strict; guest flows go through service_role in server functions.