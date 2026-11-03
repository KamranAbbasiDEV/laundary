-- Optional demo data for recording the NextFold CRM flow.
-- Apply only after 20261102_dispatch_intake_crm.sql.
-- Every record is fictional and uses reserved example.test email addresses.

insert into public.customer_accounts (
  id, account_type, display_name, company_name, contact_name, email, phone, notes, active
) values
  ('10000000-0000-4000-8000-000000000001', 'person', 'Ava Brooks', null, 'Ava Brooks', 'ava.brooks@example.test', '+1 202-555-0101', '[DEMO] Prefers fragrance-free detergent and text updates.', true),
  ('10000000-0000-4000-8000-000000000002', 'person', 'Marcus Lee', null, 'Marcus Lee', 'marcus.lee@example.test', '+1 202-555-0102', '[DEMO] Concierge accepts pickups after 9:00 AM.', true),
  ('10000000-0000-4000-8000-000000000003', 'person', 'Sofia Patel', null, 'Sofia Patel', 'sofia.patel@example.test', '+1 202-555-0103', '[DEMO] Separate dry cleaning from wash-and-fold.', true),
  ('20000000-0000-4000-8000-000000000001', 'company', 'Luna Hospitality Group', 'Luna Hospitality Group', 'Jordan Ellis', 'operations@lunahospitality.example.test', '+1 202-555-0121', '[DEMO] Multi-location hospitality account. Call the site contact on arrival.', true),
  ('20000000-0000-4000-8000-000000000002', 'company', 'Bayview Wellness Studio', 'Bayview Wellness Studio', 'Nina Flores', 'frontdesk@bayviewwellness.example.test', '+1 202-555-0122', '[DEMO] Towels and linens require unscented processing.', true),
  ('20000000-0000-4000-8000-000000000003', 'company', 'Northstar Property Partners', 'Northstar Property Partners', 'Theo Grant', 'facilities@northstarproperties.example.test', '+1 202-555-0123', '[DEMO] Choose the property address associated with the service request.', true)
on conflict (id) do update set
  account_type = excluded.account_type,
  display_name = excluded.display_name,
  company_name = excluded.company_name,
  contact_name = excluded.contact_name,
  email = excluded.email,
  phone = excluded.phone,
  notes = excluded.notes,
  active = excluded.active,
  updated_at = now();

insert into public.customer_addresses (
  id, account_id, label, address, is_default
) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Home', '1 Dr Carlton B Goodlett Place, San Francisco, CA 94102', true),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Apartment', '1 Ferry Building, San Francisco, CA 94111', true),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'Home', '151 3rd Street, San Francisco, CA 94103', true),
  ('30000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000001', 'Downtown Hotel', '135 4th Street, San Francisco, CA 94103', true),
  ('30000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000001', 'Union Square Suites', '333 Post Street, San Francisco, CA 94108', false),
  ('30000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000002', 'Main Studio', '151 3rd Street, San Francisco, CA 94103', true),
  ('30000000-0000-4000-8000-000000000031', '20000000-0000-4000-8000-000000000003', 'Ballpark Property', '24 Willie Mays Plaza, San Francisco, CA 94107', true),
  ('30000000-0000-4000-8000-000000000032', '20000000-0000-4000-8000-000000000003', 'Mission Bay Property', '1 Warriors Way, San Francisco, CA 94158', false)
on conflict (id) do update set
  account_id = excluded.account_id,
  label = excluded.label,
  address = excluded.address,
  is_default = excluded.is_default,
  updated_at = now();

-- Cleanup, if needed after the recording:
-- delete from public.customer_accounts
-- where id::text like '10000000-%' or id::text like '20000000-%';
