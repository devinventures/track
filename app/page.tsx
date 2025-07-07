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

// Chart.js context type (unused but kept for reference)
// type ChartContext = {
//   chart: {
//     ctx: CanvasRenderingContext2D;
//     chartArea: {
//       top: number;
//       bottom: number;
//     } | null;
//   };
// };

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
  // const [checkInTime, setCheckInTime] = useState<string | null>(null);
  // const [shiftEndTime, setShiftEndTime] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | undefined>(undefined);
  const [userIds, setUserIds] = useState<string[]>([]);

  const timelineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { 
      x: { 
        type: 'time' as const, 
        time: { 
          unit: 'minute' as const, 
          tooltipFormat: 'h:mm:ss a', 
          displayFormats: { 
            minute: 'h:mm a',
            hour: 'h:mm a'
          } 
        }, 
        grid: { display: true, color: '#e5e7eb' }, 
        ticks: { 
          color: '#9ca3af', 
          maxRotation: 45, 
          autoSkip: true,
          maxTicksLimit: 10
        } 
      }, 
      y: { 
        beginAtZero: true,
        max: 1,
        grid: { color: '#e5e7eb', drawBorder: false }, 
        ticks: { 
          color: '#9ca3af',
          stepSize: 1,
          callback: function(tickValue: string | number) {
            const value = typeof tickValue === 'number' ? tickValue : parseFloat(tickValue);
            return value === 1 ? 'Productive' : value === 0 ? 'Idle' : '';
          }
        }, 
        title: { display: true, text: 'Activity Status', color: '#4b5563' } 
      } 
    },
    plugins: { 
      legend: { 
        display: false
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
        titleFont: { weight: 'bold' as const },
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: function(tooltipItem: any) {
            const point = tooltipItem.raw;
            return point.status === 'productive' ? 'Productive' : 'Idle';
          }
        }
      } 
    },
    elements: { 
      point: { radius: 2, hoverRadius: 4, hitRadius: 10 }, 
      line: { tension: 0 } 
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
        setActivityLogs(sortedLogs.slice(0, 5));

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
          // setCheckInTime(earliestStart ? new Date(earliestStart).toLocaleTimeString() : null);
          // setShiftEndTime(latestEnd ? new Date(latestEnd).toLocaleTimeString() : null);
          
          // Create a proper timeline with minute-by-minute activity
          const timelineData: { x: number; y: number; status: string }[] = [];
          if (todaysLogs.length > 0) {
            let startTime: Date, endTime: Date;
            
            if (earliestStart && latestEnd) {
              startTime = new Date(earliestStart);
              endTime = new Date(latestEnd);
            } else {
              // Fallback: use a full workday if we don't have proper start/end times
              const today = new Date();
              startTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0); // 9 AM
              endTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0, 0); // 5 PM
            }
            
            // Ensure we have at least 2 hours of data for a meaningful timeline
            const timeDiff = endTime.getTime() - startTime.getTime();
            const minTimeSpan = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
            
            if (timeDiff < minTimeSpan) {
              // Extend the timeline to show at least 2 hours
              const midTime = new Date(startTime.getTime() + timeDiff / 2);
              startTime = new Date(midTime.getTime() - minTimeSpan / 2);
              endTime = new Date(midTime.getTime() + minTimeSpan / 2);
            }
            
            // Create minute-by-minute timeline
            for (let time = new Date(startTime); time <= endTime; time.setMinutes(time.getMinutes() + 1)) {
              let status = 'idle'; // default to idle
              
              // Check if user was productive during this minute
              const activeLog = todaysLogs.find(log => {
                const logStart = new Date(log.start_time);
                const logEnd = new Date(log.end_time || new Date(log.start_time).getTime() + (log.duration * 1000));
                return time >= logStart && time < logEnd;
              });
              
              if (activeLog && activeLog.movement_type === 'productive') {
                status = 'productive';
              }
              
              timelineData.push({
                x: time.getTime(),
                y: status === 'productive' ? 1 : 0,
                status: status
              });
            }
            
            console.log('Timeline data:', {
              startTime: startTime.toLocaleString(),
              endTime: endTime.toLocaleString(),
              dataPoints: timelineData.length,
              productiveCount: timelineData.filter(p => p.status === 'productive').length,
              idleCount: timelineData.filter(p => p.status === 'idle').length
            });
          }
          
          if (timelineData.length > 0) {
            newTimelineData = {
              datasets: [
                {
                  label: 'Activity Status',
                  data: timelineData,
                  borderColor: '#6366f1',
                  backgroundColor: timelineData.map(point => 
                    point.status === 'productive' ? '#6366f1' : '#fbbf24'
                  ),
                  pointBackgroundColor: timelineData.map(point => 
                    point.status === 'productive' ? '#6366f1' : '#fbbf24'
                  ),
                  pointBorderColor: timelineData.map(point => 
                    point.status === 'productive' ? '#6366f1' : '#fbbf24'
                  ),
                  pointRadius: 1,
                  pointHoverRadius: 4,
                  fill: false,
                  tension: 0,
                  stepped: 'before',
                  borderWidth: 3,
                },
              ],
            };
          } else {
            console.log('No timeline data generated');
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="rounded-2xl shadow-lg p-8 flex flex-col items-start bg-green-100 border border-gray-100">
          <span className="text-gray-700 font-bold text-lg mb-2">% Time Productive</span>
          <span className="text-4xl font-extrabold mt-1 text-gray-900">
            {(() => {
              const totalTime = stats[0].value + stats[1].value;
              const productivePercentage = totalTime > 0 ? (stats[0].value / totalTime) * 100 : 0;
              return `${productivePercentage.toFixed(1)}%`;
            })()}
          </span>
          <span className="mt-2 text-base text-gray-500">Of total work time</span>
        </div>
        <div className="rounded-2xl shadow-lg p-8 flex flex-col items-start bg-yellow-100 border border-gray-100">
          <span className="text-gray-700 font-bold text-lg mb-2">% Time Idle</span>
          <span className="text-4xl font-extrabold mt-1 text-gray-900">
            {(() => {
              const totalTime = stats[0].value + stats[1].value;
              const idlePercentage = totalTime > 0 ? (stats[1].value / totalTime) * 100 : 0;
              return `${idlePercentage.toFixed(1)}%`;
            })()}
          </span>
          <span className="mt-2 text-base text-gray-500">Of total work time</span>
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
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 mt-8">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Today&apos;s Check-ins & Check-outs</h2>
        <div className="overflow-hidden">
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-left text-xs table-fixed">
              <thead>
                <tr className="text-gray-500 border-b">
                  <th className="py-1 px-2 w-1/2">Time</th>
                  <th className="py-1 px-2 w-1/2">Duration</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const today = new Date().toISOString().slice(0, 10);
                  const todaysLogs = activityLogs.filter(
                    (row) => String(row.user_id) === selectedUser && row.start_time?.slice(0, 10) === today
                  ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

                  if (todaysLogs.length === 0) {
                    return (
                      <tr>
                        <td colSpan={2} className="py-4 px-2 text-center text-gray-500">
                          No activity recorded today
                        </td>
                      </tr>
                    );
                  }

                  return todaysLogs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-1 px-2 text-gray-600">
                        {log.start_time ? new Date(log.start_time).toLocaleTimeString() : ""}
                        {log.end_time && (
                          <span className="text-gray-400 ml-1">
                            → {new Date(log.end_time).toLocaleTimeString()}
                          </span>
                        )}
                      </td>
                      <td className="py-1 px-2 text-gray-600">
                        {log.duration}s
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 mt-8">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Recent Activity</h2>
        <div className="overflow-hidden">
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-left text-xs table-fixed">
              <thead>
                <tr className="text-gray-500 border-b">
                  <th className="py-1 px-2 w-1/4">Type</th>
                  <th className="py-1 px-2 w-1/4">Start</th>
                  <th className="py-1 px-2 w-1/4">Duration</th>
                  <th className="py-1 px-2 w-1/4">Intensity</th>
                </tr>
              </thead>
              <tbody>
                {activityLogs.map((log) => {
                  // Parse features to get motion intensity
                  let motionIntensity = "N/A";
                  try {
                    if (log.features && typeof log.features === 'object') {
                      const features = log.features as Record<string, unknown>;
                      const intensity = features.motion_intensity;
                      motionIntensity = intensity && typeof intensity === 'number' ? 
                        intensity.toFixed(3) : "N/A";
                    }
                  } catch {
                    motionIntensity = "N/A";
                  }

                  return (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-1 px-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          log.movement_type?.toLowerCase() === 'productive' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {log.movement_type}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-gray-600 truncate">
                        {log.start_time ? new Date(log.start_time).toLocaleTimeString() : ""}
                      </td>
                      <td className="py-1 px-2 text-gray-600">
                        {log.duration}s
                      </td>
                      <td className="py-1 px-2 text-gray-600">
                        {motionIntensity}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
