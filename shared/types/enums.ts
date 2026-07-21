export enum MemberStatus {
  PENDING_PAYMENT = "pending_payment",
  PENDING_APPROVAL = "pending_approval",
  PENDING_ACTIVATION = "pending_activation",
  ACTIVE = "active",
  GRACE = "grace",
  EXPIRED = "expired",
  FROZEN = "frozen",
  CANCELLED = "cancelled",
  BANNED = "banned",
}

export enum Role {
  OWNER = "owner",
  MANAGER = "manager",
  TRAINER = "trainer",
  FRONT_DESK = "front_desk",
  MEMBER = "member",
}

export enum EnrollmentMode {
  OPEN = "open",
  APPROVED = "approved",
  INVITE_ONLY = "invite_only",
}

export enum BillingType {
  RECURRING = "recurring",
  ONE_TIME_PACK = "one_time_pack",
  DROP_IN = "drop_in",
}

export enum PaymentMethod {
  CARD = "card",
  CASH = "cash",
  BANK_TRANSFER = "bank_transfer",
  MOBILE_WALLET = "mobile_wallet",
}

export enum GymStatus {
  OPEN = "open",
  CLOSED = "closed",
  HALF_DAY = "half_day",
}

export enum SaasTier {
  STARTER = "starter",
  PRO = "pro",
  ENTERPRISE = "enterprise",
}

export enum SaasStatus {
  ACTIVE = "active",
  GRACE = "grace",
  SUSPENDED = "suspended",
  CANCELLED = "cancelled",
}
