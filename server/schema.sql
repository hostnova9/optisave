CREATE TABLE IF NOT EXISTS users(id BIGSERIAL PRIMARY KEY,email VARCHAR(255) UNIQUE NOT NULL,password_hash TEXT NOT NULL,full_name VARCHAR(180) NOT NULL,phone VARCHAR(40),country VARCHAR(80),date_of_birth DATE,gender VARCHAR(40),email_verified BOOLEAN NOT NULL DEFAULT FALSE,status VARCHAR(30) NOT NULL DEFAULT 'active',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS wallets(id BIGSERIAL PRIMARY KEY,user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,available_balance NUMERIC(18,2) NOT NULL DEFAULT 0,total_deposited NUMERIC(18,2) NOT NULL DEFAULT 0,total_withdrawn NUMERIC(18,2) NOT NULL DEFAULT 0,total_locked NUMERIC(18,2) NOT NULL DEFAULT 0,total_credited NUMERIC(18,2) NOT NULL DEFAULT 0,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CHECK(available_balance>=0));
CREATE TABLE IF NOT EXISTS plans(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,plan_name VARCHAR(160) NOT NULL,purpose TEXT,plan_type VARCHAR(40) NOT NULL,original_amount NUMERIC(18,2) NOT NULL DEFAULT 0,remaining_locked NUMERIC(18,2) NOT NULL DEFAULT 0,allocation_percent NUMERIC(5,2) NOT NULL DEFAULT 0,allocation_amount NUMERIC(18,2) NOT NULL DEFAULT 0,allocation_remaining NUMERIC(18,2) NOT NULL DEFAULT 0,saved_amount NUMERIC(18,2) NOT NULL DEFAULT 0,daily_amount NUMERIC(18,2) NOT NULL DEFAULT 0,start_at TIMESTAMPTZ,maturity_at TIMESTAMPTZ,next_event_at TIMESTAMPTZ,exclude_weekends BOOLEAN NOT NULL DEFAULT FALSE,emergency_used BOOLEAN NOT NULL DEFAULT FALSE,status VARCHAR(30) NOT NULL DEFAULT 'active',metadata JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS transactions(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,wallet_id BIGINT REFERENCES wallets(id) ON DELETE SET NULL,plan_id BIGINT REFERENCES plans(id) ON DELETE SET NULL,type VARCHAR(80) NOT NULL,amount NUMERIC(18,2) NOT NULL DEFAULT 0,direction VARCHAR(10),description TEXT,status VARCHAR(30) NOT NULL DEFAULT 'completed',reference VARCHAR(120) UNIQUE,metadata JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS notifications(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,title VARCHAR(180) NOT NULL,message TEXT NOT NULL,type VARCHAR(30) NOT NULL DEFAULT 'info',action_url TEXT,is_read BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS bank_accounts(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,bank_name VARCHAR(160) NOT NULL,bank_code VARCHAR(30),account_number_last4 VARCHAR(4) NOT NULL,account_name VARCHAR(180) NOT NULL,is_verified BOOLEAN NOT NULL DEFAULT FALSE,is_primary BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS kyc_profiles(id BIGSERIAL PRIMARY KEY,user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,document_type VARCHAR(80),document_number_masked VARCHAR(80),provider_reference VARCHAR(180),status VARCHAR(30) NOT NULL DEFAULT 'not_submitted',submitted_at TIMESTAMPTZ,verified_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_plans_user_status ON plans(user_id,status);CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id,created_at DESC);CREATE INDEX IF NOT EXISTS idx_transactions_plan ON transactions(plan_id,created_at DESC);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS previous_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS transaction_pin_hash TEXT;

CREATE TABLE IF NOT EXISTS user_settings(
 user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 notification_preferences JSONB NOT NULL DEFAULT '{"moneyAlerts":true,"savingAlerts":true,"reminderAlerts":true}'::jsonb,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admins(
 id BIGSERIAL PRIMARY KEY,
 email VARCHAR(255) UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 full_name VARCHAR(180) NOT NULL DEFAULT 'OptiSave Administrator',
 role VARCHAR(40) NOT NULL DEFAULT 'super_admin',
 status VARCHAR(30) NOT NULL DEFAULT 'active',
 last_login_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE kyc_profiles ADD COLUMN IF NOT EXISTS bank_name_match BOOLEAN;
ALTER TABLE kyc_profiles ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(180);
ALTER TABLE kyc_profiles ADD COLUMN IF NOT EXISTS match_score NUMERIC(5,2);
ALTER TABLE kyc_profiles ADD COLUMN IF NOT EXISTS review_reason TEXT;
ALTER TABLE kyc_profiles ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE kyc_profiles ADD COLUMN IF NOT EXISTS reviewed_by BIGINT;

ALTER TABLE kyc_profiles ADD COLUMN IF NOT EXISTS provider_customer_code VARCHAR(180);
ALTER TABLE kyc_profiles ADD COLUMN IF NOT EXISTS provider_status VARCHAR(40);
ALTER TABLE kyc_profiles ADD COLUMN IF NOT EXISTS provider_reason TEXT;
ALTER TABLE kyc_profiles ADD COLUMN IF NOT EXISTS provider_checked_at TIMESTAMPTZ;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS provider_recipient_code VARCHAR(180);

ALTER TABLE kyc_profiles ADD COLUMN IF NOT EXISTS verification_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kyc_profiles ADD COLUMN IF NOT EXISTS last_verification_started_at TIMESTAMPTZ;

-- v1.21 financial engine hardening
ALTER TABLE plans ADD COLUMN IF NOT EXISTS allocation_converted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS daily_early_access_used BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS matured_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_plans_due_events ON plans(status,next_event_at) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_plans_maturity ON plans(status,maturity_at) WHERE status='active';

-- v1.24 unified financial schedule fields
ALTER TABLE plans ADD COLUMN IF NOT EXISTS schedule_total_events INTEGER NOT NULL DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS schedule_completed_events INTEGER NOT NULL DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS event_amount NUMERIC(18,2) NOT NULL DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS source_transaction_id BIGINT REFERENCES transactions(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_source_tx ON notifications(source_transaction_id) WHERE source_transaction_id IS NOT NULL;

-- v1.29 real-money payment state
CREATE INDEX IF NOT EXISTS idx_transactions_reference_status ON transactions(reference,status);

-- v1.36 authentication, OTP and session hardening
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS auth_otps(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,purpose VARCHAR(40) NOT NULL,code_hash TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,expires_at TIMESTAMPTZ NOT NULL,consumed_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_auth_otps_user_purpose ON auth_otps(user_id,purpose,created_at DESC);
CREATE TABLE IF NOT EXISTS login_events(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,event_type VARCHAR(40) NOT NULL DEFAULT 'login',ip_address VARCHAR(80),user_agent TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_login_events_user_created ON login_events(user_id,created_at DESC);


-- v1.39 identity uniqueness and duplicate-account protection
ALTER TABLE users ADD COLUMN IF NOT EXISTS normalized_phone VARCHAR(40);
-- Backfill only phone values that are unique after normalization so legacy duplicates do not break migration.
WITH normalized AS (
  SELECT id, regexp_replace(phone, '[^0-9+]', '', 'g') AS p
  FROM users WHERE phone IS NOT NULL AND btrim(phone)<>''
), singleton AS (SELECT p FROM normalized WHERE p<>'' GROUP BY p HAVING COUNT(*)=1)
UPDATE users u SET normalized_phone=n.p FROM normalized n JOIN singleton s ON s.p=n.p WHERE u.id=n.id AND u.normalized_phone IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_normalized_phone_unique ON users(normalized_phone) WHERE normalized_phone IS NOT NULL AND normalized_phone<>'';
ALTER TABLE kyc_profiles ADD COLUMN IF NOT EXISTS bvn_fingerprint VARCHAR(64);
ALTER TABLE kyc_profiles ADD COLUMN IF NOT EXISTS bank_account_fingerprint VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kyc_bvn_fingerprint_unique ON kyc_profiles(bvn_fingerprint) WHERE bvn_fingerprint IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_kyc_bank_fingerprint_unique ON kyc_profiles(bank_account_fingerprint) WHERE bank_account_fingerprint IS NOT NULL;


-- v1.40 real sessions / trusted devices
CREATE TABLE IF NOT EXISTS account_sessions(
 id UUID PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 user_agent TEXT,
 ip_address VARCHAR(80),
 device_label VARCHAR(160),
 browser_label VARCHAR(80),
 location_label VARCHAR(160),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_account_sessions_user_seen ON account_sessions(user_id,last_seen_at DESC);

-- v1.47 Daily Savings day ledger: one immutable row per eligible Lagos saving date.
CREATE TABLE IF NOT EXISTS daily_saving_events(
 id BIGSERIAL PRIMARY KEY,
 plan_id BIGINT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 schedule_date DATE NOT NULL,
 event_no INTEGER NOT NULL,
 amount NUMERIC(18,2) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'due' CHECK(status IN ('due','paid','defaulted')),
 due_at TIMESTAMPTZ NOT NULL,
 paid_at TIMESTAMPTZ,
 defaulted_at TIMESTAMPTZ,
 reminder_5am_at TIMESTAMPTZ,
 reminder_noon_at TIMESTAMPTZ,
 reminder_6pm_at TIMESTAMPTZ,
 final_notice_at TIMESTAMPTZ,
 transaction_id BIGINT REFERENCES transactions(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(plan_id,schedule_date),
 UNIQUE(plan_id,event_no)
);
CREATE INDEX IF NOT EXISTS idx_daily_saving_events_plan_date ON daily_saving_events(plan_id,schedule_date DESC);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_key VARCHAR(180);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_event_key ON notifications(event_key) WHERE event_key IS NOT NULL;

-- v1.54 production-readiness: immutable-style financial ledger, request idempotency and engine recovery state.
CREATE TABLE IF NOT EXISTS financial_ledger(
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 wallet_id BIGINT REFERENCES wallets(id) ON DELETE SET NULL,
 plan_id BIGINT REFERENCES plans(id) ON DELETE SET NULL,
 transaction_id BIGINT REFERENCES transactions(id) ON DELETE SET NULL,
 entry_type VARCHAR(100) NOT NULL,
 direction VARCHAR(12) NOT NULL CHECK(direction IN ('credit','debit','internal')),
 amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(amount>=0),
 available_before NUMERIC(18,2),
 available_after NUMERIC(18,2),
 locked_before NUMERIC(18,2),
 locked_after NUMERIC(18,2),
 idempotency_key VARCHAR(200) NOT NULL UNIQUE,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_user_created ON financial_ledger(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_plan_created ON financial_ledger(plan_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_transaction ON financial_ledger(transaction_id);

CREATE TABLE IF NOT EXISTS idempotency_requests(
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 action VARCHAR(100) NOT NULL,
 idempotency_key VARCHAR(160) NOT NULL,
 request_hash VARCHAR(64) NOT NULL,
 status_code INTEGER,
 response_body JSONB,
 completed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(user_id,action,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_requests(created_at DESC);

CREATE TABLE IF NOT EXISTS financial_engine_state(
 singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(singleton),
 last_started_at TIMESTAMPTZ,
 last_completed_at TIMESTAMPTZ,
 last_success_at TIMESTAMPTZ,
 last_checked_count INTEGER NOT NULL DEFAULT 0,
 last_processed_count INTEGER NOT NULL DEFAULT 0,
 last_error_count INTEGER NOT NULL DEFAULT 0,
 last_error TEXT,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO financial_engine_state(singleton) VALUES(TRUE) ON CONFLICT(singleton) DO NOTHING;

-- v1.54 safe historical backfill. Existing completed/reserved financial transactions are
-- represented without invented before/after balances; all new runtime movements record snapshots.
INSERT INTO financial_ledger(user_id,wallet_id,plan_id,transaction_id,entry_type,direction,amount,idempotency_key,metadata,created_at)
SELECT t.user_id,t.wallet_id,t.plan_id,t.id,t.type,
 CASE WHEN t.direction IN ('credit','debit','internal') THEN t.direction ELSE 'internal' END,
 GREATEST(t.amount,0),
 'LEGACY_TX_'||t.id||'_'||UPPER(COALESCE(t.direction,'INTERNAL')),
 jsonb_build_object('legacyBackfill',true,'reference',t.reference,'transactionStatus',t.status),t.created_at
FROM transactions t
WHERE t.amount>0
 AND (t.status='completed' OR (t.type='Withdrawal' AND t.status='pending' AND COALESCE(t.metadata->>'reserved','false')='true'))
 AND NOT EXISTS (SELECT 1 FROM financial_ledger existing WHERE existing.transaction_id=t.id)
ON CONFLICT(idempotency_key) DO NOTHING;

-- v1.58 Admin Broadcast Center: branded multi-user communications and segmentation.
CREATE TABLE IF NOT EXISTS broadcasts(
 id BIGSERIAL PRIMARY KEY,
 admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL,
 title VARCHAR(180) NOT NULL,
 subtitle VARCHAR(220),
 message TEXT NOT NULL,
 message_type VARCHAR(30) NOT NULL DEFAULT 'info',
 audience_type VARCHAR(40) NOT NULL,
 audience_filters JSONB NOT NULL DEFAULT '{}'::jsonb,
 channels JSONB NOT NULL DEFAULT '{"inApp":true,"email":false}'::jsonb,
 action_label VARCHAR(80),
 action_url TEXT,
 recipient_count INTEGER NOT NULL DEFAULT 0,
 email_sent_count INTEGER NOT NULL DEFAULT 0,
 email_failed_count INTEGER NOT NULL DEFAULT 0,
 status VARCHAR(30) NOT NULL DEFAULT 'sent',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON broadcasts(created_at DESC);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS broadcast_id BIGINT REFERENCES broadcasts(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS subtitle VARCHAR(220);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_label VARCHAR(80);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS brand_style VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_notifications_broadcast ON notifications(broadcast_id) WHERE broadcast_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS broadcast_recipients(
 broadcast_id BIGINT NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 notification_id BIGINT REFERENCES notifications(id) ON DELETE SET NULL,
 email_status VARCHAR(30) NOT NULL DEFAULT 'not_requested',
 email_error TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(broadcast_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_user ON broadcast_recipients(user_id,created_at DESC);

-- v1.59 Company Mailer: branded external business correspondence and partner outreach tracking.
CREATE TABLE IF NOT EXISTS company_mail_brand(
 singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(singleton),
 company_name VARCHAR(180) NOT NULL DEFAULT 'OptiSave Digital Solutions Ltd',
 rc_number VARCHAR(60) NOT NULL DEFAULT '9899018',
 support_email VARCHAR(180) NOT NULL DEFAULT 'support@myoptisave.site',
 website TEXT NOT NULL DEFAULT 'https://myoptisave.site',
 logo_url TEXT NOT NULL DEFAULT 'images/optisave-broadcast-logo.png',
 tagline VARCHAR(180) NOT NULL DEFAULT 'Save Better. Live Better.',
 sender_name VARCHAR(180) NOT NULL DEFAULT 'Adesokan Samson',
 sender_title VARCHAR(120) NOT NULL DEFAULT 'Director',
 primary_color VARCHAR(7) NOT NULL DEFAULT '#071a4b',
 accent_color VARCHAR(7) NOT NULL DEFAULT '#1269e8',
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO company_mail_brand(singleton) VALUES(TRUE) ON CONFLICT(singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS company_mail_messages(
 id BIGSERIAL PRIMARY KEY,
 admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL,
 to_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
 cc_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
 bcc_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
 subject VARCHAR(220) NOT NULL,
 title VARCHAR(220),
 greeting VARCHAR(220),
 body_text TEXT NOT NULL,
 layout VARCHAR(30) NOT NULL DEFAULT 'formal',
 cta_label VARCHAR(100),
 cta_url TEXT,
 attachment_metadata JSONB NOT NULL DEFAULT '[]'::jsonb,
 status VARCHAR(30) NOT NULL DEFAULT 'pending',
 provider_id VARCHAR(220),
 provider_error TEXT,
 is_test BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 sent_at TIMESTAMPTZ
);
ALTER TABLE company_mail_messages ADD COLUMN IF NOT EXISTS request_key VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_mail_request_key ON company_mail_messages(request_key) WHERE request_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_mail_created ON company_mail_messages(created_at DESC);

CREATE TABLE IF NOT EXISTS company_contacts(
 id BIGSERIAL PRIMARY KEY,
 company_name VARCHAR(180) NOT NULL,
 contact_name VARCHAR(180),
 email VARCHAR(180) NOT NULL,
 category VARCHAR(60) NOT NULL DEFAULT 'bank',
 status VARCHAR(40) NOT NULL DEFAULT 'new',
 notes TEXT,
 last_contact_at TIMESTAMPTZ,
 next_follow_up_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_contacts_email_lower ON company_contacts(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_company_contacts_status ON company_contacts(status,updated_at DESC);



-- v1.69 Fincra Sandbox Integration Lab. Isolated test logs only; never changes OptiSave user balances.
CREATE TABLE IF NOT EXISTS fincra_sandbox_logs(
 id BIGSERIAL PRIMARY KEY,
 admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL,
 event_type VARCHAR(30) NOT NULL DEFAULT 'request',
 action VARCHAR(100) NOT NULL,
 ok BOOLEAN NOT NULL DEFAULT FALSE,
 http_status INTEGER,
 latency_ms INTEGER,
 response_json JSONB,
 error_text TEXT,
 signature_valid BOOLEAN,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fincra_sandbox_logs_created ON fincra_sandbox_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fincra_sandbox_logs_action ON fincra_sandbox_logs(action,created_at DESC);

-- Staff accounts and immediate revocation of stale login tokens.
ALTER TABLE admins ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS admin_activity (
 id BIGSERIAL PRIMARY KEY,
 actor_admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL,
 target_admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL,
 action VARCHAR(80) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON admin_activity(created_at DESC);
