# Mobile App

Expo React Native app for gym members, trainers, front-desk staff, and admin quick actions.

## Stack

- **Framework**: Expo SDK 52 + React Native
- **Navigation**: Expo Router (file-based)
- **State**: Zustand + MMKV (persistent)
- **Auth**: JWT scoped to organization_id

## Structure (planned)

```
app/
├── (auth)/       # Org code entry, login, MFA
├── (member)/     # Dashboard, classes, payments, receipt upload
├── (staff)/      # Check-in, cash log, approve receipts
└── (admin)/      # Approvals, toggle status, announcements
```

## Getting Started

```bash
cd mobileapp
npm install
npx expo start
```

> **Note:** This directory is scaffolded. App implementation is in progress.
