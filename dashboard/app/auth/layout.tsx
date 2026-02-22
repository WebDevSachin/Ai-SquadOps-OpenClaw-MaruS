import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Authentication - SquadOps",
  description: "Sign in to your SquadOps account",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth pages don't have the sidebar - they are standalone pages
  return (
    <div className="min-h-screen bg-gray-950">
      {children}
    </div>
  );
}
