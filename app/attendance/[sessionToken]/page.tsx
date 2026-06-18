import { StudentAttendance } from "@/components/StudentAttendance";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ sessionToken: string }>;
};

export default async function AttendancePage({ params }: Props) {
  const { sessionToken } = await params;
  return <StudentAttendance sessionToken={sessionToken} />;
}
