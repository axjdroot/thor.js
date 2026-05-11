import { redirect } from "next/navigation";

export const runtime = 'edge';

export default function AdminIndexPage() {
  redirect('/admin/dashboard');
}
