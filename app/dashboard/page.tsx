"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { FiBarChart2, FiUsers, FiFileText, FiSettings, FiHelpCircle, FiLogOut, FiTrendingUp, FiSearch } from "react-icons/fi";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// Define ActivityLog type
type ActivityLog = {
  id?: string;
  user_id: string;
  movement_type: string;
  duration: number;
  start_time: string;
  end_time?: string;
  confidence?: number;
  created_at?: string;
  features?: any;
  motion_data?: any;
};

export default function DashboardPage() {
  const [user, setUser] = useState({ name: "Noah Smith", email: "noah@email.com", avatar: "https://randomuser.me/api/portraits/men/32.jpg" });
  const [stats, setStats] = useState([
    { label: "Idle", value: 0, color: "bg-yellow-100", icon: "⏰", text: "Team total" },
    { label: "Productive", value: 0, color: "bg-indigo-100", icon: "✅", text: "Team total" },
  ]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any>({ labels: [], datasets: [] });
  const [analytics, setAnalytics] = useState<ActivityLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [laborChartData, setLaborChartData] = useState<any>({ labels: [], datasets: [] });
  const [laborStats, setLaborStats] = useState<{ manual: number; shelving: number; packaging: number }>({ manual: 0, shelving: 0, packaging: 0 });
  const [productivityFilter, setProductivityFilter] = useState<"all" | "today">("today");
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [shiftEndTime, setShiftEndTime] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | undefined>(undefined);
  const [userIds, setUserIds] = useState<string[]>([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      type UserDayAgg = {
        [userId: string]: {
          productive: { [date: string]: number };
          idle: { [date: string]: number };
        };
      };
      const userDayAgg: UserDayAgg = {};

      const { data } = await supabase
        .from("activity_logs")
        .select("user_id, movement_type, duration, start_time, end_time");

      (data ?? []).forEach(row => {
        const user = String(row.user_id);
        const day = typeof row.start_time === "string" ? row.start_time.slice(0, 10) : undefined;
        const type = typeof row.movement_type === "string" ? row.movement_type.trim().toLowerCase() : undefined;
        if (!user || !day || !type) return;
        if (!userDayAgg[user]) userDayAgg[user] = { productive: {}, idle: {} };
        if (type === "productive" || type === "idle") {
          if (!userDayAgg[user][type][day]) userDayAgg[user][type][day] = 0;
          userDayAgg[user][type][day] += Number(row.duration) || 0;
        }
      });

      const ids = Object.keys(userDayAgg);
      setUserIds(ids);
      if (!selectedUser && ids.length > 0) {
        setSelectedUser(ids[0]);
      }

      // Get all unique dates for the selected user, sorted
      let allDates: string[] = [];
      let dailyProductive: number[] = [];
      let dailyIdle: number[] = [];
      let totalProductive = 0;
      let totalIdle = 0;
      if (selectedUser && userDayAgg[selectedUser]) {
        const prodDates = Object.keys(userDayAgg[selectedUser].productive);
        const idleDates = Object.keys(userDayAgg[selectedUser].idle);
        allDates = Array.from(new Set([...prodDates, ...idleDates])).sort();
        dailyProductive = allDates.map(day => (userDayAgg[selectedUser]?.productive[day] || 0) / 60);
        dailyIdle = allDates.map(day => (userDayAgg[selectedUser]?.idle[day] || 0) / 60);
        const productiveObj = userDayAgg[selectedUser].productive || {};
        const idleObj = userDayAgg[selectedUser].idle || {};

        if (productivityFilter === "all") {
          totalProductive = Object.values(productiveObj).reduce((a, b) => a + b, 0);
          totalIdle = Object.values(idleObj).reduce((a, b) => a + b, 0);
        } else if (productivityFilter === "today") {
          const today = new Date().toISOString().slice(0, 10);
          totalProductive = productiveObj[today] || 0;
          totalIdle = idleObj[today] || 0;
        }
      }

      setChartData({
        labels: allDates.map(d => d.slice(5)), // MM-DD for display
        datasets: [
          {
            label: "Productive Time",
            data: dailyProductive,
            backgroundColor: "#6366f1",
            borderRadius: 8,
            barPercentage: 0.6,
          },
          {
            label: "Idle Time",
            data: dailyIdle,
            backgroundColor: "#fbbf24",
            borderRadius: 8,
            barPercentage: 0.6,
          },
        ],
      });

      setStats([
        { label: "Idle", value: totalIdle / 3600, color: "bg-yellow-100", icon: "⏰", text: "Team total" },
        { label: "Productive", value: totalProductive / 3600, color: "bg-indigo-100", icon: "✅", text: "Team total" },
      ]);

      // Check In and Shift End Time logic
      if (selectedUser) {
        const today = new Date().toISOString().slice(0, 10);
        const todaysLogs = (data ?? []).filter(
          (row) =>
            String(row.user_id) === selectedUser &&
            typeof row.start_time === "string" &&
            row.start_time.slice(0, 10) === today
        );
        let earliestStart: string | null = null;
        let latestEnd: string | null = null;
        todaysLogs.forEach((row) => {
          if (row.start_time && (!earliestStart || row.start_time < earliestStart)) {
            earliestStart = row.start_time;
          }
          if (row.end_time && (!latestEnd || row.end_time > latestEnd)) {
            latestEnd = row.end_time;
          }
        });
        setCheckInTime(earliestStart ? new Date(earliestStart).toLocaleTimeString() : null);
        setShiftEndTime(latestEnd ? new Date(latestEnd).toLocaleTimeString() : null);
      } else {
        setCheckInTime(null);
        setShiftEndTime(null);
      }

      setLoading(false);
    }
    fetchData();
  }, [selectedUser, productivityFilter]);

  useEffect(() => {
    async function fetchAnalytics() {
      const { data } = await supabase.from("analytics").select("*");
      if (data) setAnalytics(data);
    }
    fetchAnalytics();
  }, []);

  useEffect(() => {
    async function fetchActivityLogs() {
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .order("start_time", { ascending: false })
        .limit(10);
      if (data) setActivityLogs(data);
    }
    fetchActivityLogs();
  }, []);

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 min-h-screen bg-[#181C2A] flex flex-col py-8 px-4">
        <div className="mb-10 flex items-center gap-2">
          <span className="text-2xl font-extrabold text-white tracking-tight">Track v1</span>
        </div>
        <nav className="flex flex-col gap-2 flex-1">
          <a href="#" className="flex items-center gap-3 text-white font-semibold bg-[#23263A] rounded-lg px-4 py-2">
            <FiBarChart2 /> Overview
          </a>
          <a href="#" className="flex items-center gap-3 text-gray-400 hover:text-white rounded-lg px-4 py-2">
            <FiTrendingUp /> Growth
          </a>
          <a href="#" className="flex items-center gap-3 text-gray-400 hover:text-white rounded-lg px-4 py-2">
            <FiUsers /> Customers
          </a>
          <a href="#" className="flex items-center gap-3 text-gray-400 hover:text-white rounded-lg px-4 py-2">
            <FiFileText /> Reports
          </a>
          <a href="#" className="flex items-center gap-3 text-gray-400 hover:text-white rounded-lg px-4 py-2">
            <FiHelpCircle /> Support
          </a>
          <a href="#" className="flex items-center gap-3 text-gray-400 hover:text-white rounded-lg px-4 py-2">
            <FiSettings /> Settings
          </a>
        </nav>
        <a href="#" className="flex items-center gap-3 text-gray-400 hover:text-white rounded-lg px-4 py-2 mt-8">
          <FiLogOut /> Log out
        </a>
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

        {/* Main Dashboard Content */}
        <main className="flex-1 p-8 bg-gray-50">
          {/* User Select Dropdown */}
          {userIds.length > 0 && (
            <div className="mb-6">
              <label htmlFor="user-select" className="block mb-2 text-gray-700 font-semibold">Select User:</label>
              <select
                id="user-select"
                value={selectedUser}
                onChange={e => setSelectedUser(e.target.value)}
                className="p-2 border rounded w-full max-w-xs"
              >
                {userIds.map(uid => (
                  <option key={uid} value={uid}>{uid}</option>
                ))}
              </select>
            </div>
          )}
          {/* Filter Buttons */}
          <div className="mb-4 flex gap-4">
            <button
              className={`px-4 py-2 rounded-lg font-semibold border ${productivityFilter === "all" ? "bg-indigo-600 text-white" : "bg-white text-indigo-600 border-indigo-600"}`}
              onClick={() => setProductivityFilter("all")}
            >
              All Time
            </button>
            <button
              className={`px-4 py-2 rounded-lg font-semibold border ${productivityFilter === "today" ? "bg-indigo-600 text-white" : "bg-white text-indigo-600 border-indigo-600"}`}
              onClick={() => setProductivityFilter("today")}
            >
              Today
            </button>
          </div>
          {/* Stat Cards */}
          <div className="flex flex-col md:flex-row gap-6 mb-8">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className={`flex-1 rounded-2xl shadow-lg p-8 flex flex-col items-start ${stat.color} border border-gray-100`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-3xl">{stat.icon}</span>
                  <span className="text-gray-700 font-bold text-lg">{stat.label}</span>
                </div>
                <span className="text-4xl font-extrabold mt-1 text-gray-900">
                  {Number(stat.value).toFixed(2)} h
                </span>
                <span className="mt-2 text-base text-gray-500">{stat.text}</span>
              </div>
            ))}
          </div>
          {/* Check In and Shift End Time Section (moved below chart) */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 mt-8 flex flex-col md:flex-row gap-8 items-center justify-center">
            <div className="flex flex-col items-center">
              <span className="text-gray-500 font-semibold mb-1">Check In Time</span>
              <span className="text-2xl font-bold text-indigo-600">{checkInTime || "--"}</span>
            </div>
            <div className="w-px h-10 bg-gray-200 mx-8 hidden md:block"></div>
            <div className="flex flex-col items-center">
              <span className="text-gray-500 font-semibold mb-1">Shift End Time</span>
              <span className="text-2xl font-bold text-indigo-600">{shiftEndTime || "--"}</span>
            </div>
          </div>
          {/* Productive vs Idle Time Chart */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 mt-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Productive vs Idle Time</h2>
            <div className="h-80 flex items-center justify-center text-gray-400">
              {loading || !chartData ? (
                "[Loading Chart...]"
              ) : (
                <Bar
                  data={chartData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        position: "top" as const,
                        labels: {
                          color: "#181C2A",
                          font: { size: 16, weight: "bold" },
                          boxWidth: 20,
                        },
                      },
                      tooltip: {
                        backgroundColor: "#fff",
                        titleColor: "#181C2A",
                        bodyColor: "#181C2A",
                        borderColor: "#6366f1",
                        borderWidth: 1,
                        padding: 12,
                      },
                    },
                    scales: {
                      x: {
                        grid: { display: false },
                        ticks: { color: "#181C2A", font: { size: 14 } },
                      },
                      y: {
                        beginAtZero: true,
                        title: { display: true, text: "Minutes", color: "#181C2A", font: { size: 16 } },
                        grid: { color: "#e5e7eb" },
                        ticks: { color: "#181C2A", font: { size: 14 } },
                      },
                    },
                  }}
                />
              )}
            </div>
          </div>
          {/* Manual Labor, Shelving, Packaging Chart */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 mt-12">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Manual Labor, Shelving & Packaging (Minutes per Day)</h2>
            <div className="h-80 flex items-center justify-center text-gray-400">
              {laborChartData ? (
                <Bar
                  data={laborChartData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        position: "top",
                        labels: {
                          color: "#181C2A",
                          font: { size: 16, weight: "bold" },
                          boxWidth: 20,
                        },
                      },
                    },
                    scales: {
                      x: {
                        grid: { display: false },
                        ticks: { color: "#181C2A", font: { size: 14 } },
                      },
                      y: {
                        beginAtZero: true,
                        title: { display: true, text: "Minutes", color: "#181C2A", font: { size: 16 } },
                        grid: { color: "#e5e7eb" },
                        ticks: { color: "#181C2A", font: { size: 14 } },
                      },
                    },
                  }}
                />
              ) : (
                "[Loading Chart...]"
              )}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 mt-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Recent Activity</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="text-gray-500 border-b">
                    <th className="py-2 px-3">ID</th>
                    <th className="py-2 px-3">User</th>
                    <th className="py-2 px-3">Movement</th>
                    <th className="py-2 px-3">Start</th>
                    <th className="py-2 px-3">End</th>
                    <th className="py-2 px-3">Duration (s)</th>
                    <th className="py-2 px-3">Confidence</th>
                    <th className="py-2 px-3">Created</th>
                    <th className="py-2 px-3">Features</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLogs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="py-2 px-3">{log.id}</td>
                      <td className="py-2 px-3">{log.user_id}</td>
                      <td className="py-2 px-3">{log.movement_type}</td>
                      <td className="py-2 px-3">{log.start_time ? new Date(log.start_time).toLocaleString() : ""}</td>
                      <td className="py-2 px-3">{log.end_time ? new Date(log.end_time ?? '').toLocaleString() : ""}</td>
                      <td className="py-2 px-3">{log.duration}</td>
                      <td className="py-2 px-3">{log.confidence}</td>
                      <td className="py-2 px-3">{log.created_at ? new Date(log.created_at).toLocaleString() : ""}</td>
                      <td className="py-2 px-3 truncate max-w-xs">{log.features || log.motion_data ? JSON.stringify(log.features || log.motion_data).slice(0, 30) + "..." : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
} 