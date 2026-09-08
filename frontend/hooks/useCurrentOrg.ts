"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { OrganizationOut } from "@/lib/types";

/** Current active org (industry + currency + branding). Null until loaded. */
export function useCurrentOrg() {
  const [org, setOrg] = useState<OrganizationOut | null>(null);

  useEffect(() => {
    api
      .get<OrganizationOut>("/organizations/me")
      .then(setOrg)
      .catch(() => setOrg(null));
  }, []);

  return org;
}
