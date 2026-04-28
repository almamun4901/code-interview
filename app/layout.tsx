import type { Metadata } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "CodeInterview",
  description: "Practice technical interviews against your own GitHub commits.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
