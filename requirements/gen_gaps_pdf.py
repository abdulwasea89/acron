"""Generate a compact 'Frontend Launch Gaps' PDF from the verified audit."""
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether,
)

OUT = "/home/abdulwasea/Documents/learn/best_project/requirements/Frontend_Launch_Gaps.pdf"

# ---- palette ----
INK = colors.HexColor("#1a1a1a")
MUTED = colors.HexColor("#666666")
HEAD_BG = colors.HexColor("#1f2937")
ROW_ALT = colors.HexColor("#f4f6f8")
LINE = colors.HexColor("#d7dce1")
RED = colors.HexColor("#c0392b")
ORANGE = colors.HexColor("#d68910")
YELLOW = colors.HexColor("#b7950b")
GREEN = colors.HexColor("#1e8449")

styles = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=18, textColor=INK,
                    spaceAfter=2, leading=22)
SUB = ParagraphStyle("SUB", parent=styles["Normal"], fontSize=9, textColor=MUTED,
                     spaceAfter=10, leading=12)
H2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=12.5, textColor=HEAD_BG,
                    spaceBefore=12, spaceAfter=5, leading=15)
BODY = ParagraphStyle("BODY", parent=styles["Normal"], fontSize=8.4, textColor=INK,
                      leading=11)
CELL = ParagraphStyle("CELL", parent=styles["Normal"], fontSize=7.6, textColor=INK,
                      leading=9.5)
CELLB = ParagraphStyle("CELLB", parent=CELL, fontName="Helvetica-Bold")
HEADC = ParagraphStyle("HEADC", parent=styles["Normal"], fontSize=7.8,
                       textColor=colors.white, fontName="Helvetica-Bold", leading=9.5)

def hx(c): return "#" + c.hexval()[2:]

def P(t, s=CELL): return Paragraph(t, s)

def table(headers, rows, widths):
    data = [[Paragraph(h, HEADC) for h in headers]]
    for r in rows:
        data.append([P(c) if not isinstance(c, Paragraph) else c for c in r])
    t = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), HEAD_BG),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, HEAD_BG),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), ROW_ALT))
    t.setStyle(TableStyle(style))
    return t

def sev(txt, color):
    return Paragraph(f'<font color="{hx(color)}"><b>{txt}</b></font>', CELL)

doc = SimpleDocTemplate(OUT, pagesize=A4,
                        leftMargin=13*mm, rightMargin=13*mm,
                        topMargin=13*mm, bottomMargin=12*mm,
                        title="Frontend Launch Gaps")
E = []

E.append(Paragraph("Frontend Launch Gaps &amp; Readiness", H1))
E.append(Paragraph(
    "Gym Operations Platform — Admin Web Portal (Next.js). Verified against current code, "
    "2026-07-18. Scope: admin web only; mobile Expo app is unbuilt (member/trainer flows §19–29 out of scope). "
    "State today: ~5k LOC, 12 admin + 5 auth pages → 99-endpoint FastAPI backend via server-side auth proxy.",
    SUB))

# ---- 1. Launch-blocking ----
E.append(Paragraph("1 · Launch-Blocking Missing Features", H2))
rows = [
    ["1", P("Real-time WebSocket sync", CELLB), "§16.4", "Backend /ws exists; frontend has ZERO WS usage", sev("Critical", RED), "Core promise ('no refresh buttons'); data stale until reload"],
    ["2", P("MFA management UI", CELLB), "§5.5", "Backend /auth/mfa/* exists; 0 UI refs", sev("Critical", RED), "Enterprise tier = mandatory MFA; cannot onboard"],
    ["3", P("Session management UI", CELLB), "§5.9 / Rule 8", "Backend /auth/sessions + revoke; 0 UI", sev("Critical", RED), "'Owner can revoke any session' is a security rule"],
    ["4", P("error / loading / not-found", CELLB), "UX", "None in app/", sev("Critical", RED), "Any thrown fetch = white-screen crash in prod"],
    ["5", P("Classes management page", CELLB), "§21, §6.4", "Backend classes.py (6 ep); no page", sev("High", ORANGE), "Bookings, rosters, check-ins unreachable"],
    ["6", P("Staff / Trainer page", CELLB), "§7,15,24", "Backend staff.py (11 ep); no page", sev("High", ORANGE), "Can't invite trainers / set rates; payroll depends on it"],
    ["7", P("Audit log viewer", CELLB), "§16.1 / R10", "Backend records audits; no page", sev("High", ORANGE), "'Full searchable audit log' = named web capability"],
    ["8", P("Approval queue (enrollment)", CELLB), "§8.3", "Backend supports approved mode; no UI", sev("High", ORANGE), "Approved-mode gyms can't approve prospects"],
    ["9", P("Middleware auth guard", CELLB), "Security", "Per-layout redirect only; no middleware.ts", sev("Medium", YELLOW), "Fragile; no central route protection / CSP"],
    ["10", P("Automated tests", CELLB), "Quality", "Zero frontend tests", sev("Medium", YELLOW), "No regression net for money-handling product"],
]
E.append(table(["#", "Feature", "Spec", "Status Now", "Sev", "Why It Blocks Launch"],
               rows, [7*mm, 30*mm, 15*mm, 44*mm, 15*mm, 53*mm]))

# ---- 2. Coverage matrix ----
E.append(Paragraph("2 · Spec Domain → Frontend Coverage", H2))
def cov(v, c): return Paragraph(f'<font color="{hx(c)}"><b>{v}</b></font>', CELL)
rows = [
    ["Auth (login/register/reset/magic)", "20 ep", "5 pages", cov("~85%", GREEN), "No MFA enroll; verify resend UX"],
    ["Organizations / Settings", "9 ep", "settings", cov("~50%", ORANGE), "No MFA, no sessions, no logo/accent branding"],
    ["SaaS Billing", "6 ep", "billing", cov("~70%", YELLOW), "No invoice PDF; downgrade cap-warning UX"],
    ["Plans", "10 ep", "plans", cov("~90%", GREEN), "Strong; verify archive→replacement picker"],
    ["Members", "7 ep", "members", cov("~80%", GREEN), "CSV import ok; verify freeze/ban actions"],
    ["Memberships", "8 ep", "(in members)", cov("~40%", ORANGE), "No dedicated subscription lifecycle view"],
    ["Payments", "2 ep", "payments", cov("~70%", YELLOW), "Verify web-only refund UI (Rule 7)"],
    ["Cash", "2 ep", "cash", cov("~90%", GREEN), "Reconciliation likely covered"],
    ["Receipts", "5 ep", "receipts", cov("~75%", YELLOW), "Queue ok; no image lightbox / audit reversal"],
    ["Classes", "6 ep", cov("none", RED), cov("0%", RED), "Whole domain unreachable"],
    ["Staff", "11 ep", cov("none", RED), cov("0%", RED), "Whole domain unreachable"],
    ["Payroll", "9 ep", "payroll", cov("~80%", GREEN), "Verify draft→lock→finalize→CSV flow"],
    ["Analytics", "2 ep", "analytics", cov("~70%", YELLOW), "Charts ok; no CSV export (§16.1)"],
    ["Real-time", "ws", cov("none", RED), cov("0%", RED), "See blocker #1"],
]
E.append(table(["Domain", "Backend", "Frontend", "Coverage", "Gap"],
               rows, [42*mm, 16*mm, 24*mm, 20*mm, 62*mm]))

# ---- 3. Edge cases ----
E.append(Paragraph("3 · Edge Cases &amp; Edge Problems", H2))
rows = [
    ["Auth", "Access token expires (15m) mid-POST", "Refresh-on-401 exists but untested for bodies", "Verify body re-sent on retry; add test"],
    ["Auth", "Refresh token (7d) expires → refresh fails", "Raw 401 may bubble", "Global redirect-to-login, not crash"],
    ["Auth", "Vague login errors (Rule 4)", "Backend vague; frontend may leak field", "Audit error rendering"],
    ["Idempotency", "Double-tap Pay / submit", "Proxy forwards key; who makes UUID?", "Client generates UUID + disables btn (§13.9)"],
    ["Multi-org", "Org switch mid-session (§14.3)", "Switcher exists; stale WS/data?", "Full reload + JWT re-scope"],
    ["Payments", "Stripe in STUB mode (stripe_live=false)", "Real card form won't work", "Wire Stripe Elements + live keys"],
    ["SaaS", "Read-only (d6) / suspended (d30) states", "Frontend may not render them", "Add banner + disable mutations"],
    ["UX", "Empty states (new gym, 0 rows)", "Some EmptyState used", "Audit every list page"],
    ["Concurrency", "Two admins edit same plan", "No optimistic-lock UX", "Stale-write warning"],
    ["Locale", "Org timezone / currency vs browser", "May render wrong TZ/currency", "Centralize in format.ts"],
]
E.append(table(["Area", "Edge Case / Problem", "Current Risk", "Fix"],
               rows, [22*mm, 50*mm, 47*mm, 45*mm]))

# ---- 4. Common problems ----
E.append(Paragraph("4 · Common Cross-Cutting Problems", H2))
rows = [
    ["error.tsx / global-error.tsx", cov("Missing", RED), "Prod crash = blank page", "Add root + per-segment"],
    ["loading.tsx skeletons", cov("Missing", RED), "Janky perceived perf", "Add per-segment"],
    ["not-found.tsx", cov("Missing", RED), "Ugly 404", "Add"],
    ["CAPTCHA on signup forms", "Backend only", "Bot signups", "Wire hCaptcha/Turnstile (§7.3)"],
    ["CSP / security headers", cov("Missing", RED), "XSS surface", "Add via next.config headers"],
    ["Sentry / error monitoring", cov("Missing", RED), "Blind in prod", "Wire Sentry (spec Monitoring)"],
    ["Accessibility (a11y) pass", "Unknown", "Legal/UX risk", "Labels, focus, contrast"],
    ["Responsive (tablet/mobile-web)", "Unknown", "Owner on-the-go usage", "Test breakpoints"],
    ["Env config per environment", "Hardcoded default", "Staging/prod misconfig", "BACKEND_URL per env"],
    ["Toast / global notifications", "Unknown", "Silent failures", "Confirm global toaster"],
]
E.append(table(["Problem", "Present?", "Impact", "Action"],
               rows, [46*mm, 26*mm, 44*mm, 48*mm]))

# ---- 5. Infra ----
E.append(Paragraph("5 · Infra / Ops Blockers (backend-side)", H2))
rows = [
    ["Alembic migrations", cov("None (SQLite auto)", RED), sev("Yes", RED), "Need Postgres migrations"],
    ["docker-compose.yml", cov("Empty stub", RED), sev("Yes", RED), "—"],
    ["Postgres + Redis", cov("Not provisioned", RED), sev("Yes", RED), "SQLite default only"],
    ["Stripe live keys (Platform+Connect)", cov("Stubbed", RED), sev("Yes", RED), "For real payments"],
    ["Email (Resend) domain verify", cov("Known issue", ORANGE), sev("Partial", ORANGE), "Invites silently fail"],
    ["Real OCR / GPT-4o Vision", cov("Stubbed", YELLOW), sev("No*", YELLOW), "Receipts auto-approve fake"],
    ["S3 / R2 file storage", cov("Not wired", ORANGE), sev("Partial", ORANGE), "Receipt images, PDFs"],
    ["Celery + Redis broker", cov("Needs Redis", ORANGE), sev("Partial", ORANGE), "Workers won't run"],
]
E.append(table(["Item", "State", "Blocks?", "Note"],
               rows, [48*mm, 40*mm, 22*mm, 54*mm]))

# ---- Launch path ----
E.append(Paragraph("Recommended Launch Path", H2))
for t in [
    "<b>P0 — do not ship without:</b> WS real-time (#1), MFA UI (#2), Session UI (#3), "
    "error/loading boundaries (#4), Stripe live wiring, Postgres + Alembic, docker-compose.",
    "<b>P1 — full product:</b> Classes page (#5), Staff page (#6), Audit log (#7), "
    "analytics CSV export, SaaS read-only/suspended states.",
    "<b>P2 — hardening:</b> tests, Sentry, CSP headers, a11y, empty-state audit, approval queue.",
]:
    E.append(Paragraph("• " + t, BODY))
    E.append(Spacer(1, 3))

doc.build(E)
print("WROTE", OUT)
