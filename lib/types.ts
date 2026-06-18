export type AttendanceStatus = "on_time" | "late" | "absent" | "sick" | "leave" | "excused";

export type Student = {
  id: string;
  student_number: string;
  full_name: string;
  section: string | null;
  contact_number: string | null;
  profile_photo_path: string | null;
  profile_photo_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Section = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Subject = {
  id: string;
  section_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SubjectStudent = {
  subject_id: string;
  student_id: string;
  created_at: string;
};

export type AttendanceSession = {
  id: string;
  session_token: string;
  section_id: string | null;
  subject_id: string | null;
  class_name: string;
  subject: string | null;
  section: string | null;
  session_date: string;
  start_time: string;
  cutoff_time: string;
  close_time: string;
  created_at: string;
};

export type AttendanceRecord = {
  id: string;
  session_id: string;
  student_id: string;
  submitted_at: string | null;
  status: AttendanceStatus;
  photo_path: string | null;
  photo_deleted_at: string | null;
  notes: string | null;
  manual_override: boolean;
  created_at: string;
  updated_at: string;
};

export type DashboardRecord = {
  record_id: string | null;
  student_id: string;
  student_number: string;
  full_name: string;
  section: string | null;
  contact_number: string | null;
  profile_photo_path: string | null;
  profile_photo_url: string | null;
  submitted_at: string | null;
  status: AttendanceStatus;
  photo_path: string | null;
  photo_deleted_at: string | null;
  photo_url: string | null;
  notes: string | null;
  manual_override: boolean;
  late_count: number;
  repeated_late: boolean;
  absent_count?: number;
  attendance_closed?: boolean;
};

export type AppSettings = {
  id: number;
  semaphore_api_key: string | null;
  semaphore_sender_name: string | null;
  default_late_limit: number;
  default_absent_limit: number;
  default_automatic_sms: boolean;
  proof_retention_days: number;
  storage_warning_mb: number;
  created_at: string;
  updated_at: string;
};

export type SubjectAlertSettings = {
  subject_id: string;
  automatic_sms: boolean;
  late_limit: number;
  absent_limit: number;
  late_template: string | null;
  absent_template: string | null;
  alert_period_start: string;
  created_at: string;
  updated_at: string;
};

export type SmsAlert = {
  id: string;
  student_id: string;
  subject_id: string;
  trigger_type: "late" | "absent";
  threshold: number;
  phone_number: string | null;
  message: string;
  sent_at: string | null;
  provider_status: string | null;
  alert_period_start: string;
  created_at: string;
};
