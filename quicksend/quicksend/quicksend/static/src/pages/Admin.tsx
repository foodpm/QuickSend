import React, { useEffect, useState } from 'react';
import { getDB, initTCB } from '../utils/tcb';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { Users, Activity, FileText, ArrowLeft, RefreshCw, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

const Admin = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    todayActive: 0,
    yesterdayActive: 0,
    totalFiles: 0
  });
  const [dauData, setDauData] = useState<any[]>([]);
  const [fileLogs, setFileLogs] = useState<any[]>([]);
  const [password, setPassword] = useState('');
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') === 'true') {
      setIsAuth(true);
    }
  }, []);

  useEffect(() => {
    if (isAuth) {
      loadData();
    }
  }, [isAuth]);

  const loadData = async () => {
    setLoading(true);
    try {
      await initTCB();
      const db = getDB();
      if (!db) return;

      const usersCount = await db.collection('quick_users').count();

      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const todayCount = await db.collection('quick_daily_active').where({ date: today }).count();
      const yesterdayCount = await db.collection('quick_daily_active').where({ date: yesterday }).count();

      const filesCount = await db.collection('quick_file_stats').count();

      setStats({
        totalUsers: usersCount.total,
        todayActive: todayCount.total,
        yesterdayActive: yesterdayCount.total,
        totalFiles: filesCount.total
      });

      const activeRes = await db.collection('quick_daily_active').orderBy('date', 'desc').limit(100).get();

      const dayMap: Record<string, number> = {};
      activeRes.data.forEach((item: any) => {
        dayMap[item.date] = (dayMap[item.date] || 0) + 1;
      });

      const chartData = Object.keys(dayMap)
        .map((date) => ({
          date,
          count: dayMap[date]
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setDauData(chartData);

      const logsRes = await db.collection('quick_file_stats').orderBy('timestamp', 'desc').limit(20).get();

      setFileLogs(logsRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123') {
      setIsAuth(true);
      sessionStorage.setItem('admin_auth', 'true');
    } else {
      alert('密码错误');
    }
  };

  if (!isAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm">
          <h2 className="text-xl font-bold mb-6 text-center">后台管理系统</h2>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg mb-4"
            placeholder="请输入访问密码"
          />
          <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700">
            登录
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 bg-white rounded-lg shadow-sm hover:bg-slate-50">
              <ArrowLeft size={20} className="text-slate-600" />
            </Link>
            <h1 className="text-2xl font-bold text-slate-800">QuickSend 数据统计</h1>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            刷新数据
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="累计安装用户" value={stats.totalUsers} icon={Users} color="bg-blue-500" />
          <StatCard title="今日活跃用户" value={stats.todayActive} icon={Activity} color="bg-green-500" />
          <StatCard title="昨日活跃用户" value={stats.yesterdayActive} icon={Calendar} color="bg-orange-500" />
          <StatCard title="累计文件传输" value={stats.totalFiles} icon={FileText} color="bg-purple-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-semibold mb-6">活跃用户趋势 (DAU)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dauData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-semibold mb-6">最新文件传输记录</h3>
            <div className="overflow-auto h-64">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2">时间</th>
                    <th className="px-4 py-2">类型</th>
                    <th className="px-4 py-2 text-right">数量</th>
                    <th className="px-4 py-2 text-right">大小</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fileLogs.map((log, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-600">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${log.type === 'upload' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}
                        >
                          {log.type === 'upload' ? '上传' : '下载'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{log.count}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-500">
                        {(log.size / 1024 / 1024).toFixed(2)} MB
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color }: any) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center text-white shadow-lg shadow-blue-500/20`}>
      <Icon size={24} />
    </div>
    <div>
      <p className="text-sm text-slate-500 font-medium">{title}</p>
      <h4 className="text-2xl font-bold text-slate-800 mt-1">{value}</h4>
    </div>
  </div>
);

export default Admin;
