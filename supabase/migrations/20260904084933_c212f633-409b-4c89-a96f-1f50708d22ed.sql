create policy "No client writes to credit purchases"
on public.credit_purchases
for insert to authenticated
with check (false);

create policy "No client updates to credit purchases"
on public.credit_purchases
for update to authenticated
using (false) with check (false);

create policy "No client deletes from credit purchases"
on public.credit_purchases
for delete to authenticated
using (false);

create policy "No client writes to pi payments"
on public.pi_payments
for insert to authenticated
with check (false);

create policy "No client updates to pi payments"
on public.pi_payments
for update to authenticated
using (false) with check (false);

create policy "No client deletes from pi payments"
on public.pi_payments
for delete to authenticated
using (false);