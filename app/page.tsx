"use client";

import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  TimeScale,
  Tooltip,
  Legend,
  ChartData,
  Filler,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import 'chartjs-adapter-date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  TimeScale,
  Tooltip,
  Legend,
  Filler
);

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
  features?: unknown;
  motion_data?: unknown;
};

type Stat = {
  label: string;
  value: number;
  color: string;
  text: string;
  prefix?: string;
  suffix?: string;
};

// Define proper types for Chart.js context
type ChartContext = {
  chart: {
    ctx: CanvasRenderingContext2D;
    chartArea: {
      top: number;
      bottom: number;
    } | null;
  };
};

// Renamed from HomePage to DashboardPage
export default function DashboardPage() {
  const [stats, setStats] = useState<Stat[]>([
    { label: "Productive", value: 0, color: "bg-indigo-100", text: "Team total", suffix: 'h' },
    { label: "Idle", value: 0, color: "bg-yellow-100", text: "Team total", suffix: 'h' },
    { label: "Wasted Spend", value: 0, color: "bg-red-100", text: "Cost of idle time", prefix: '$' },
  ]);
  const [loading, setLoading] = useState(true);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [barChartData, setBarChartData] = useState<ChartData<'bar'>>({ datasets: [] });
  const [timelineChartData, setTimelineChartData] = useState<ChartData<'line'>>({ datasets: [] });
  const [productivityFilter, setProductivityFilter] = useState<"all" | "today">("today");
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [shiftEndTime, setShiftEndTime] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | undefined>(undefined);
  const [userIds, setUserIds] = useState<string[]>([]);

  const timelineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { 
      x: { 
        type: 'time' as const, 
        time: { 
          unit: 'hour' as const, 
          tooltipFormat: 'h:mm a', 
          displayFormats: { hour: 'h a' } 
        }, 
        grid: { display: false }, 
        ticks: { color: '#9ca3af', maxRotation: 0, autoSkip: true } 
      }, 
      y: { 
        beginAtZero: true, 
        grid: { color: '#e5e7eb', drawBorder: false }, 
        ticks: { color: '#9ca3af' }, 
        title: { display: true, text: 'Cumulative Minutes', color: '#4b5563' } 
      } 
    },
    plugins: { 
      legend: { 
        display: true, 
        position: 'top' as const, 
        align: 'end' as const, 
        labels: { boxWidth: 12, usePointStyle: true } 
      }, 
      tooltip: { 
        enabled: true, 
        mode: 'index' as const, 
        intersect: false, 
        backgroundColor: '#fff', 
        titleColor: '#1f2937', 
        bodyColor: '#4b5563', 
        borderColor: '#e5e7eb', 
        borderWidth: 1, 
        padding: 12, 
        titleFont: { weight: 'bold' as const } 
      } 
    },
    elements: { 
      point: { radius: 0, hoverRadius: 5, hitRadius: 20, hoverBorderWidth: 2 }, 
      line: { tension: 0.4 } 
    },
    interaction: { mode: 'index' as const, intersect: false },
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      try {
        async function fetchAllActivityLogs() {
          let allLogs: ActivityLog[] = [];
          let offset = 0;
          const BATCH_SIZE = 1000;
          while (true) {
            const { data, error } = await supabase.from("activity_logs").select("*").range(offset, offset + BATCH_SIZE - 1);
            if (error) { 
              console.error("Error fetching logs:", error); 
              break; 
            }
            if (!data || data.length === 0) break;
            allLogs = [...allLogs, ...data];
            if (data.length < BATCH_SIZE) break;
            offset += BATCH_SIZE;
          }
          return allLogs;
        }

        const [ activityData, { data: configData } ] = await Promise.all([
          fetchAllActivityLogs(),
          supabase.from("company_config").select("user_id, hourly_wage")
        ]);
        
        const sortedLogs = [...activityData].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
        setActivityLogs(sortedLogs.slice(0, 10));

        const wageMap = new Map<string, number>(configData?.map(c => [c.user_id, c.hourly_wage]) || []);
        type UserDayAgg = { [userId: string]: { productive: { [date: string]: number }; idle: { [date: string]: number }; }; };
        const userDayAgg: UserDayAgg = {};

        activityData.forEach(row => {
          const user = String(row.user_id);
          const day = row.start_time?.slice(0, 10);
          const type = row.movement_type?.trim().toLowerCase();
          if (!user || !day || !type) return;
          if (!userDayAgg[user]) userDayAgg[user] = { productive: {}, idle: {} };
          if (type === "productive" || type === "idle") {
            userDayAgg[user][type][day] = (userDayAgg[user][type][day] || 0) + (Number(row.duration) || 0);
          }
        });

        const ids = Object.keys(userDayAgg);
        setUserIds(ids);
        
        if (!selectedUser && ids.length > 0) {
          setSelectedUser(ids[0]);
          return;
        }
        
        const currentSelectedUser = selectedUser || (ids.length > 0 ? ids[0] : undefined);
        if (!currentSelectedUser) {
          setLoading(false);
          return;
        }
        
        let totalProductive = 0, totalIdle = 0, wastedSpend = 0;
        let newBarChartData: ChartData<'bar'> = { datasets: [] };
        let newTimelineData: ChartData<'line'> = { datasets: [] };
        
        if (userDayAgg[currentSelectedUser]) {
          const productiveObj = userDayAgg[currentSelectedUser].productive || {};
          const idleObj = userDayAgg[currentSelectedUser].idle || {};
          const allDates = Array.from(new Set([...Object.keys(productiveObj), ...Object.keys(idleObj)])).sort();

          newBarChartData = {
            labels: allDates.map(d => d.slice(5)),
            datasets: [
              { label: "Productive Time", data: allDates.map(day => (productiveObj[day] || 0) / 60), backgroundColor: "#6366f1", borderRadius: 8 },
              { label: "Idle Time", data: allDates.map(day => (idleObj[day] || 0) / 60), backgroundColor: "#fbbf24", borderRadius: 8 },
            ],
          };

          if (productivityFilter === 'all') {
            totalProductive = Object.values(productiveObj).reduce((a, b) => a + b, 0);
            totalIdle = Object.values(idleObj).reduce((a, b) => a + b, 0);
          } else {
            const today = new Date().toISOString().slice(0, 10);
            totalProductive = productiveObj[today] || 0;
            totalIdle = idleObj[today] || 0;
          }
          
          const hourlyWage = wageMap.get(currentSelectedUser) || 0;
          wastedSpend = (totalIdle / 3600) * hourlyWage;
          
          const today = new Date().toISOString().slice(0, 10);
          const todaysLogs = activityData.filter(
            (row) => String(row.user_id) === currentSelectedUser && row.start_time?.slice(0, 10) === today
          ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

          let earliestStart: string | null = null, latestEnd: string | null = null;
          todaysLogs.forEach((row) => {
            if (row.start_time && (!earliestStart || row.start_time < earliestStart)) earliestStart = row.start_time;
            if (row.end_time && (!latestEnd || row.end_time > latestEnd)) latestEnd = row.end_time;
          });
          setCheckInTime(earliestStart ? new Date(earliestStart).toLocaleTimeString() : null);
          setShiftEndTime(latestEnd ? new Date(latestEnd).toLocaleTimeString() : null);
          
          let cumulativeProductive = 0, cumulativeIdle = 0;
          const productiveTimeline: { x: number; y: number }[] = [];
          const idleTimeline: { x: number; y: number }[] = [];
          if (todaysLogs.length > 0) {
            productiveTimeline.push({ x: new Date(todaysLogs[0].start_time).getTime(), y: 0 });
            idleTimeline.push({ x: new Date(todaysLogs[0].start_time).getTime(), y: 0 });
            todaysLogs.forEach(log => {
              const endTime = new Date(log.end_time || log.start_time);
              const durationMinutes = (log.duration || 0) / 60;
              if (log.movement_type === 'productive') cumulativeProductive += durationMinutes;
              else if (log.movement_type === 'idle') cumulativeIdle += durationMinutes;
              productiveTimeline.push({ x: endTime.getTime(), y: cumulativeProductive });
              idleTimeline.push({ x: endTime.getTime(), y: cumulativeIdle });
            });
          }
          
          if (productiveTimeline.length > 0 || idleTimeline.length > 0) {
            newTimelineData = {
              datasets: [
                {
                  label: 'Productive',
                  data: productiveTimeline,
                  borderColor: '#6366f1',
                  pointHoverBackgroundColor: '#6366f1',
                  fill: true,
                  tension: 0.3,
                  pointRadius: 0,
                  backgroundColor: (context: ChartContext) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) {
                      return 'rgba(99, 102, 241, 0.2)';
                    }
                    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, 'rgba(99, 102, 241, 0)');
                    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.3)');
                    return gradient;
                  },
                },
                {
                  label: 'Idle',
                  data: idleTimeline,
                  borderColor: '#fbbf24',
                  pointHoverBackgroundColor: '#fbbf24',
                  fill: true,
                  tension: 0.3,
                  pointRadius: 0,
                  backgroundColor: (context: ChartContext) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) {
                      return 'rgba(251, 191, 36, 0.2)';
                    }
                    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, 'rgba(251, 191, 36, 0)');
                    gradient.addColorStop(1, 'rgba(251, 191, 36, 0.3)');
                    return gradient;
                  },
                },
              ],
            };
          }
        }
        
        setBarChartData(newBarChartData);
        setTimelineChartData(newTimelineData);
        setStats([
          { label: "Productive", value: totalProductive / 3600, color: "bg-indigo-100", text: "Team total", suffix: 'h' },
          { label: "Idle", value: totalIdle / 3600, color: "bg-yellow-100", text: "Team total", suffix: 'h' },
          { label: "Wasted Spend", value: wastedSpend, color: "bg-red-100", text: "Cost of idle time", prefix: '$' },
        ]);

      } catch (error) {
        console.error("Error in fetchData:", error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [selectedUser, productivityFilter]);

  return (
    <>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-2xl shadow-lg p-8 flex flex-col items-start ${stat.color} border border-gray-100`}
          >
            <span className="text-gray-700 font-bold text-lg mb-2">{stat.label}</span>
            <span className="text-4xl font-extrabold mt-1 text-gray-900">
              {stat.prefix}{Number(stat.value).toFixed(2)}{stat.suffix}
            </span>
            <span className="mt-2 text-base text-gray-500">{stat.text}</span>
          </div>
        ))}
      </div>
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
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 mt-8">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Today&apos;s Activity Timeline</h2>
        <div className="h-80 relative">
          {loading ? "[Loading Chart...]" : <Line data={timelineChartData} options={timelineOptions} />}
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 mt-8">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Productive vs Idle Time (All Time)</h2>
        <div className="h-80 flex items-center justify-center text-gray-400">
          {loading ? "[Loading Chart...]" : <Bar data={barChartData} options={{ responsive: true, plugins: { legend: { position: "top" as const } }, scales: { y: { title: { display: true, text: "Minutes" } } } }} />}
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
                <tr key={log.id} className="border-b hover:bg-gray-100">
                  <td className="py-2 px-3">{log.id?.slice(0, 8)}</td>
                  <td className="py-2 px-3">{log.user_id}</td>
                  <td className="py-2 px-3">{log.movement_type}</td>
                  <td className="py-2 px-3">{log.start_time ? new Date(log.start_time).toLocaleString() : ""}</td>
                  <td className="py-2 px-3">{log.end_time ? new Date(log.end_time).toLocaleString() : ""}</td>
                  <td className="py-2 px-3">{log.duration}</td>
                  <td className="py-2 px-3">{log.confidence}</td>
                  <td className="py-2 px-3">{log.created_at ? new Date(log.created_at).toLocaleDateString() : ""}</td>
                  <td className="py-2 px-3 text-xs">
                    {log.features ? JSON.stringify(log.features) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </div>
    </>
  );
}
