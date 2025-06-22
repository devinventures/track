"use client";

import { usePathname } from 'next/navigation';
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FiBarChart2, FiSettings, FiLogOut, FiSearch, FiBriefcase } from "react-icons/fi";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  return (
    <html lang="en">
      <head>
        {/* Metadata is now manually set here */}
        <title>Track v1</title>
        <meta name="description" content="Employee-first performance tracking" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen flex bg-gray-50">
          {/* Sidebar */}
          <aside className="w-64 min-h-screen bg-[#181C2A] flex flex-col py-8 px-4">
            <div className="mb-10 flex items-center gap-2">
              <span className="text-2xl font-extrabold text-white tracking-tight">Track v1</span>
            </div>
            <nav className="flex flex-col gap-2 flex-1">
              <Link
                href="/"
                className={`flex items-center gap-3 rounded-lg px-4 py-2 transition-colors ${
                  pathname === '/'
                    ? 'bg-[#23263A] text-white font-semibold'
                    : 'text-gray-400 hover:bg-[#23263A] hover:text-white'
                }`}
              >
                <FiBarChart2 /> Dashboard
              </Link>
              <Link
                href="/company-config"
                className={`flex items-center gap-3 rounded-lg px-4 py-2 transition-colors ${
                  pathname === '/company-config'
                    ? 'bg-[#23263A] text-white font-semibold'
                    : 'text-gray-400 hover:bg-[#23263A] hover:text-white'
                }`}
              >
                <FiBriefcase /> Company Config
              </Link>
              <Link
                href="/settings"
                className={`flex items-center gap-3 rounded-lg px-4 py-2 transition-colors ${
                  pathname === '/settings'
                    ? 'bg-[#23263A] text-white font-semibold'
                    : 'text-gray-400 hover:bg-[#23263A] hover:text-white'
                }`}
              >
                <FiSettings /> Settings
              </Link>
            </nav>
            <Link href="#" className="flex items-center gap-3 text-gray-400 hover:text-white rounded-lg px-4 py-2 mt-8">
              <FiLogOut /> Log out
            </Link>
          </aside>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <header className="w-full flex items-center justify-between px-8 py-6 bg-white border-b border-gray-100">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search"
                    className="pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://randomuser.me/api/portraits/men/32.jpg" alt="User" className="w-10 h-10 rounded-full border" />
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-700">Team Glistco</span>
                  <span className="text-gray-500">Daniel Yashinsky</span>
                </div>
              </div>
            </header>

            {/* Page content */}
            <main className="flex-1 p-8 bg-gray-50">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
