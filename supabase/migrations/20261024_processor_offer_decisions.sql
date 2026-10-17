-- Allow a processor to decline only its own pending capacity offer.
-- The function keeps the decline and activation of the next ranked offer atomic.

create or replace function public.reject_processor_offer(p_offer_id uuid, p_reason text default 'Processor declined')
returns table (offer_id uuid, order_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  selected_offer public.processor_offers%rowtype;
  next_offer_id uuid;
begin
  select * into selected_offer
  from public.processor_offers
  where public.processor_offers.id = p_offer_id
  for update;

  if not found then raise exception 'Processor offer not found'; end if;
  if selected_offer.status <> 'pending' or (selected_offer.expires_at is not null and selected_offer.expires_at <= now()) then
    raise exception 'This processor offer is no longer available';
  end if;
  if not exists (
    select 1 from public.profiles
    where public.profiles.id = auth.uid()
      and role = 'processor'
      and status = 'active'
      and processor_id = selected_offer.processor_id
  ) then
    raise exception 'Processor access required';
  end if;

  update public.processor_offers
  set status = 'rejected',
      rejection_reason = coalesce(nullif(trim(p_reason), ''), 'Processor declined'),
      responded_by = auth.uid(),
      responded_at = now()
  where id = selected_offer.id;

  select id into next_offer_id
  from public.processor_offers
  where order_id = selected_offer.order_id
    and status = 'withdrawn'
    and rank > selected_offer.rank
  order by rank
  limit 1
  for update;

  if next_offer_id is not null then
    update public.processor_offers
    set status = 'pending', offered_at = now(), expires_at = now() + interval '4 hours'
    where id = next_offer_id;
  end if;

  return query select selected_offer.id, selected_offer.order_id;
end;
$$;

revoke all on function public.reject_processor_offer(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.reject_processor_offer(uuid, text) to authenticated;
