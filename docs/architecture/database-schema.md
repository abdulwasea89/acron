# Database Schema

## Organizations
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | VARCHAR | Gym name |
| org_code | VARCHAR | Unique, 8-12 chars |
| saas_tier | ENUM | starter/pro/enterprise |
| saas_status | ENUM | active/grace/suspended/cancelled |
| enrollment_mode | ENUM | open/approved/invite_only |
| stripe_customer_id | VARCHAR | Platform Stripe |
| stripe_connect_account_id | VARCHAR | Connect Stripe |
| created_at | TIMESTAMP | UTC |

## Organization Members
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| organization_id | UUID | FK → organizations |
| user_id | UUID | FK → users |
| role | ENUM | owner/manager/trainer/front_desk/member |
| member_status | ENUM | pending_payment/pending_approval/active/grace/expired/frozen/cancelled/banned |
| display_name | VARCHAR | Nullable |
| phone | VARCHAR | Nullable |
| fixed_monthly_salary | NUMERIC | Default 0 |
| hourly_rate | NUMERIC | Default 0 |
| per_class_rate | NUMERIC | Default 0 |
| commission_rate | NUMERIC | Default 0 |
| created_at | TIMESTAMP | UTC |

## Users
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| email | VARCHAR | Unique, lowercase |
| hashed_password | VARCHAR | bcrypt |
| full_name | VARCHAR | Nullable |
| email_verified | BOOLEAN | Default false |
| mfa_secret | VARCHAR | Nullable |
| created_at | TIMESTAMP | UTC |
