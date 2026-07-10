"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface CurrentUser {
  user_id: string;
  org_id: string;
  role: string;
  member_id: string | null;
  member_status: string | null;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    api.get<CurrentUser>("/auth/me").then(setUser).catch(() => {});
  }, []);

  return user;
}
