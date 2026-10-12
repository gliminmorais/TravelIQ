-- Apply with an owner/migrator connection, never with the application role.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='traveliq_app') THEN CREATE ROLE traveliq_app NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF; END $$;
ALTER TABLE memberships ADD CONSTRAINT membership_role CHECK (role IN ('admin','staff'));
ALTER TABLE bookings ADD CONSTRAINT booking_status CHECK (status IN ('pending','confirmed','cancelled','refunded'));
ALTER TABLE bookings ADD CONSTRAINT booking_currency CHECK (currency='INR');
ALTER TABLE financial_records ADD CONSTRAINT financial_nonnegative CHECK (agency_cost>=0 AND customer_charged>=0);
ALTER TABLE payments ADD CONSTRAINT payment_positive CHECK(amount>0);
ALTER TABLE refunds ADD CONSTRAINT refund_positive CHECK(amount>0);
ALTER TABLE customers ADD CONSTRAINT customer_agency_key UNIQUE (agency_id,id);
ALTER TABLE bookings ADD CONSTRAINT booking_agency_key UNIQUE (agency_id,id);
ALTER TABLE bookings ADD CONSTRAINT booking_customer_same_agency FOREIGN KEY(agency_id,customer_id) REFERENCES customers(agency_id,id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['financial_records','passengers','flight_segments','payments','refunds','adjustments','documents'] LOOP
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY(agency_id,booking_id) REFERENCES bookings(agency_id,id)',t,t||'_booking_same_agency');
  EXECUTE format('CREATE INDEX %I ON %I(agency_id,booking_id)',t||'_booking_scope',t);
 END LOOP;
END $$;
CREATE INDEX audit_scope_date ON audit_logs(agency_id,created_at DESC);
REVOKE ALL ON agencies,memberships,customers,bookings,financial_records,passengers,flight_segments,payments,refunds,adjustments,documents,audit_logs FROM PUBLIC;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['agencies','customers','bookings','financial_records','passengers','flight_segments','payments','refunds','adjustments','documents','audit_logs'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  IF t='agencies' THEN
   EXECUTE 'CREATE POLICY agency_scope ON agencies TO traveliq_app USING (id::text=current_setting(''app.agency_id'',true))';
  ELSE
   EXECUTE format('CREATE POLICY agency_scope ON %I TO traveliq_app USING (agency_id::text=current_setting(''app.agency_id'',true)) WITH CHECK (agency_id::text=current_setting(''app.agency_id'',true))',t);
  END IF;
 END LOOP;
END $$;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY own_membership ON memberships FOR SELECT TO traveliq_app USING(user_id::text=current_setting('app.user_id',true));
GRANT USAGE ON SCHEMA public TO traveliq_app;
GRANT SELECT ON agencies,memberships,customers,bookings,financial_records,passengers,flight_segments,payments,refunds,adjustments,documents,audit_logs TO traveliq_app;
GRANT INSERT ON customers,bookings,financial_records,passengers,flight_segments,payments,refunds,adjustments,documents,audit_logs TO traveliq_app;
GRANT UPDATE ON customers,bookings TO traveliq_app;
GRANT DELETE ON passengers,flight_segments TO traveliq_app;
-- Immutable ledger: no UPDATE or DELETE privileges on payments, refunds, adjustments or audit logs.
CREATE TABLE request_limits(key text PRIMARY KEY,window_start timestamptz NOT NULL,count integer NOT NULL);
REVOKE ALL ON request_limits FROM PUBLIC;
CREATE FUNCTION app_rate_limit(k text,max_count integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE n integer; BEGIN
 INSERT INTO public.request_limits(key,window_start,count) VALUES(k,date_trunc('minute',now()),1)
 ON CONFLICT(key) DO UPDATE SET window_start=date_trunc('minute',now()),count=CASE WHEN public.request_limits.window_start<date_trunc('minute',now()) THEN 1 ELSE public.request_limits.count+1 END RETURNING count INTO n;
 DELETE FROM public.request_limits WHERE window_start<now()-interval '1 day';
 RETURN n<=LEAST(max_count,120);
END $$;
REVOKE ALL ON FUNCTION app_rate_limit(text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_rate_limit(text,integer) TO traveliq_app;
