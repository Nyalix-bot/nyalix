-- add shipping_email to orders table
ALTER TABLE public.orders
  ADD COLUMN shipping_email TEXT NOT NULL DEFAULT '';

-- existing RLS policies automatically cover new column since policies use USING (auth.uid() = user_id) or has_role
