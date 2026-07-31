
-- Regional pricing + payment provider tracking
ALTER TABLE public.comics ADD COLUMN IF NOT EXISTS price_ngn numeric;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_provider text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status_detail text;
CREATE INDEX IF NOT EXISTS orders_payment_reference_idx ON public.orders(payment_reference);
