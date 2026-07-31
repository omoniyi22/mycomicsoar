
-- 1. Extend comics with PDF fields
ALTER TABLE public.comics
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS page_count integer NOT NULL DEFAULT 0;

-- 2. Admin check function (super-admin by email)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND lower(email) = 'omoniyioluwaseun22@gmail.com'
  );
$$;

-- 3. Admin policies on existing catalog tables
CREATE POLICY "Admins manage comics insert" ON public.comics
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins manage comics update" ON public.comics
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins manage comics delete" ON public.comics
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Admins manage publishers insert" ON public.publishers
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins manage publishers update" ON public.publishers
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins manage publishers delete" ON public.publishers
  FOR DELETE TO authenticated USING (public.is_admin());

-- 4. Cart
CREATE TABLE public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comic_id uuid NOT NULL REFERENCES public.comics(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, comic_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cart" ON public.cart_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own orders" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own orders" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  comic_id uuid NOT NULL REFERENCES public.comics(id) ON DELETE RESTRICT,
  title text NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1
);

GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own order items" ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "Users insert own order items" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
