import { useState, useEffect } from 'react';
import { AlertCircle, ServerCrash, Activity } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');

  const fetchAlerts = async () => {
    try {
      // Fetch devices to check for OFFLINE status
      const devRes = await fetch(`${API_BASE}/devices`);
      const devices = await devRes.json();
      
      // Fetch recent events to check for LinkDown traps
      const eventUrl = filterDate ? `${API_BASE}/events?date=${filterDate}` : `${API_BASE}/events`;
      const evRes = await fetch(eventUrl);
      const events = await evRes.json();

      const activeAlerts = [];

      // Check device status
      devices.forEach(dev => {
        if (dev.status === 'OFFLINE' || dev.snmp_status === 'ERROR') {
          activeAlerts.push({
            id: `dev-${dev.id}`,
            severity: 'critical',
            title: `Device ${dev.name} is Unreachable`,
            message: `IP: ${dev.ip}. System is offline or SNMP is not responding.`,
            time: 'Active Now',
            icon: <ServerCrash size={20} className="text-error" />
          });
        }
      });

      // Check events for LinkDown
      const linkDownEvents = events.filter(e => e.event_type === 'LinkDown');
      const linkUpEvents = events.filter(e => e.event_type === 'LinkUp');
      
      linkDownEvents.forEach(downEv => {
        // Only show as alert if there hasn't been a subsequent LinkUp for this interface
        const resolved = linkUpEvents.some(upEv => 
          upEv.device_ip === downEv.device_ip && 
          upEv.if_index === downEv.if_index && 
          new Date(upEv.time) > new Date(downEv.time)
        );

        if (!resolved) {
          const dev = devices.find(d => d.ip === downEv.device_ip);
          activeAlerts.push({
            id: `ev-${downEv.id}`,
            severity: 'warning',
            title: `Interface Down on ${dev ? dev.name : downEv.device_ip}`,
            message: `Interface Index ${downEv.if_index} reported LinkDown trap.`,
            time: downEv.time,
            icon: <AlertCircle size={20} className="text-warning" />
          });
        }
      });

      setAlerts(activeAlerts);
    } catch (err) {
      console.error("Error fetching alerts", err);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAlerts();
    const timer = setInterval(fetchAlerts, 10000); // Check every 10s
    return () => clearInterval(timer);
  }, [filterDate]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Activity size={24} /> Active Alerts
        </h2>
        <div className="flex items-center gap-4">
          <input 
            type="date" 
            className="input input-bordered input-sm" 
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
          {filterDate && (
            <button className="btn btn-sm btn-ghost" onClick={() => setFilterDate('')}>Clear</button>
          )}
          <div className="badge badge-primary gap-1 p-3">
            <span className="relative flex h-3 w-3 mr-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-content opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary-content"></span>
            </span>
            Live Polling
          </div>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center p-8"><span className="loading loading-spinner loading-lg text-primary"></span></div>
      ) : alerts.length > 0 ? (
        <div className="grid gap-4">
          {alerts.map(alert => (
            <div key={alert.id} className={`alert shadow-md border-l-4 bg-base-100 ${alert.severity === 'critical' ? 'border-error' : 'border-warning'}`}>
              <div>
                {alert.icon}
                <div>
                  <h3 className="font-bold">{alert.title}</h3>
                  <div className="text-sm opacity-70">{alert.message}</div>
                </div>
              </div>
              <div className="text-xs opacity-50 whitespace-nowrap">{alert.time}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-base-100 shadow rounded-box p-8 text-center border border-base-200">
          <div className="text-success mb-2 flex justify-center"><Activity size={48} /></div>
          <h3 className="text-lg font-bold">All Systems Healthy</h3>
          <p className="text-base-content/60">No active alerts or SNMP Traps at this time.</p>
        </div>
      )}
    </div>
  );
};

export default Alerts;
