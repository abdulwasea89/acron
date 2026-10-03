import { redirect } from "next/navigation";

/**
 * Deep links to a member now open them as a sheet over the directory rather than
 * a standalone page. Redirect the old route to the list, which reads `?member=`.
 */
export default async function MemberDetailRedirect({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  redirect(`/app/members?member=${memberId}`);
}
