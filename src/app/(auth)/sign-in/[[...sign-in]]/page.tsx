import { SignIn } from "@clerk/nextjs";

export const runtime = 'edge';

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FDFCF8]">
      <SignIn appearance={{
        elements: {
          formButtonPrimary: "bg-[#121212] hover:bg-[#121212]/90 transition-colors",
          card: "rounded-2xl shadow-xl border border-black/5"
        }
      }} />
    </div>
  );
}
