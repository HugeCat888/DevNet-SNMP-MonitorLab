import { Link } from 'react-router-dom';
import { Server, Network, Bell, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalDevices: 0,
    onlineDevices: 0,
    offlineDevices: 0,
    activeAlerts: 0,
    totalInterfaces: 0,
    upInterfaces: 0,
    downInterfaces: 0,
    recentTraps: 0
  });

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard/stats`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch dashboard stats", err);
    }
  };

  useEffect(() => {
    fetchStats();
    const timer = setInterval(fetchStats, 10000); // Polling every 10 seconds
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Dashboard</h2>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat bg-base-100 shadow rounded-box">
          <div className="stat-figure text-primary">
            <Server size={32} />
          </div>
          <div className="stat-title">Monitored Devices</div>
          <div className="stat-value text-primary">{stats.totalDevices}</div>
          <div className="stat-desc">{stats.onlineDevices} Online, {stats.offlineDevices} Offline</div>
        </div>
        
        <div className="stat bg-base-100 shadow rounded-box">
          <div className="stat-figure text-error">
            <Bell size={32} />
          </div>
          <div className="stat-title">Active Alerts</div>
          <div className="stat-value text-error">{stats.activeAlerts}</div>
        </div>
        
        <div className="stat bg-base-100 shadow rounded-box">
          <div className="stat-figure text-secondary">
            <Network size={32} />
          </div>
          <div className="stat-title">Total Interfaces</div>
          <div className="stat-value text-secondary">{stats.totalInterfaces}</div>
          <div className="stat-desc">{stats.upInterfaces} UP, {stats.downInterfaces} DOWN</div>
        </div>
        
        <div className="stat bg-base-100 shadow rounded-box">
          <div className="stat-figure text-success">
            <Activity size={32} />
          </div>
          <div className="stat-title">Recent Traps (24h)</div>
          <div className="stat-value text-success">{stats.recentTraps}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Links / Actions */}
        <div className="bg-base-100 shadow rounded-box p-6">
          <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <Link to="/devices" className="btn btn-outline h-24 flex flex-col gap-2">
              <Server size={24} />
              Manage Devices
            </Link>
            <Link to="/topology" className="btn btn-outline h-24 flex flex-col gap-2">
              <Network size={24} />
              View Topology
            </Link>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-base-100 shadow rounded-box p-6">
          <h3 className="text-lg font-bold mb-4">System Processes</h3>
          <ul className="space-y-4">
            <li className="flex justify-between items-center">
              <span>SNMP Polling Worker</span>
              <span className="badge badge-success">Running</span>
            </li>
            <li className="flex justify-between items-center">
              <span>SNMP Trap Receiver (UDP 162)</span>
              <span className="badge badge-success">Listening</span>
            </li>
            <li className="flex justify-between items-center">
              <span>Database Connection</span>
              <span className="badge badge-success">Connected</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
