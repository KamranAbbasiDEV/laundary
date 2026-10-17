-- P0: make capacity acceptance atomic and automatically advance expired offers.

drop policy if exists "operations read processor offers" on public.processor_offers;
drop policy if exists "operations manage processor offers" on public.processor_offers;
drop policy if exists "processors respond to offers" on public.processor_offers;
drop policy if exists "dispatch manages processor offers" on public.processor_offers;
drop policy if exists "processors read their own offers" on public.processor_offers;

create policy "dispatch manages processor offers" on public.processor_offers
for all to authenticated
using (public.current_user_role() in ('super_admin', 'dispatcher'))
with check (public.current_user_role() in ('super_admin', 'dispatcher'));

create policy "processors read their own offers" on public.processor_offers
for select to authenticated
using (exists (
  select 1 from public.profiles profile
  where profile.id = auth.uid()
    and profile.processor_id = public.processor_offers.processor_id
    and profile.status = 'active'
));

create or replace function public.accept_processor_offer(p_offer_id uuid)
returns table (offer_id uuid, order_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  selected_offer public.processor_offers%rowtype;
  accepted_order_id uuid;
begin
  select * into selected_offer from public.processor_offers where public.processor_offers.id = p_offer_id for update;
  if not found then raise exception 'Processor offer not found'; end if;
  if selected_offer.status <> 'pending' or (selected_offer.expires_at is not null and selected_offer.expires_at <= now()) then
    raise exception 'This processor offer is no longer available';
  end if;
  if not exists (select 1 from public.profiles where public.profiles.id = auth.uid() and role = 'processor' and status = 'active' and processor_id = selected_offer.processor_id) then
    raise exception 'Processor access required';
  end if;

  update public.orders set processor_id = selected_offer.processor_id, status = 'capacity_confirmed', updated_at = now()
  where id = selected_offer.order_id and status = 'processor_ranked' returning id into accepted_order_id;
  if accepted_order_id is null then raise exception 'This order is no longer available for acceptance'; end if;

  update public.processor_offers set status = 'accepted', rejection_reason = null, responded_by = auth.uid(), responded_at = now() where id = selected_offer.id;
  update public.processor_offers set status = 'withdrawn' where order_id = selected_offer.order_id and id <> selected_offer.id and status in ('pending', 'withdrawn');
  return query select selected_offer.id, accepted_order_id;
end;
$$;

create or replace function public.advance_expired_processor_offers()
returns table (order_id uuid, offer_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  expired_offer public.processor_offers%rowtype;
  next_offer public.processor_offers%rowtype;
begin
  for expired_offer in
    select offer.* from public.processor_offers offer
    join public.orders order_record on order_record.id = offer.order_id
    where offer.status = 'pending' and offer.expires_at is not null and offer.expires_at <= now() and order_record.status = 'processor_ranked'
    order by offer.expires_at for update of offer skip locked
  loop
    update public.processor_offers set status = 'expired', responded_at = now() where id = expired_offer.id;
    select * into next_offer from public.processor_offers
    where public.processor_offers.order_id = expired_offer.order_id and status = 'withdrawn' and rank > expired_offer.rank
    order by rank limit 1 for update;
    if found then
      update public.processor_offers set status = 'pending', offered_at = now(), expires_at = now() + interval '4 hours' where id = next_offer.id;
      order_id := expired_offer.order_id;
      offer_id := next_offer.id;
      return next;
    end if;
  end loop;
end;
$$;

revoke all on function public.accept_processor_offer(uuid) from public, anon, authenticated, service_role;
grant execute on function public.accept_processor_offer(uuid) to authenticated;
revoke all on function public.advance_expired_processor_offers() from public, anon, authenticated, service_role;
grant execute on function public.advance_expired_processor_offers() to service_role;
