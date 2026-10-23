import { ProtectedLayout } from "@/components/layout/protected-layout";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
