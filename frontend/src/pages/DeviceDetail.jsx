import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Activity, Shield, Clock, Server, RefreshCw, Wifi, Search } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_BASE = 'http://localhost:8000';
const POLL_INTERVAL = 10000; // 10 seconds

const DeviceDetail = () => {
  const { id } = useParams();
  const [selectedInterface, setSelectedInterface] = useState(null);
  const [interfaces, setInterfaces] = useState([]);
  const [trafficData, setTrafficData] = useState([]);
  const [device, setDevice] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const pollTimerRef = useRef(null);

  const fetchDeviceAndInterfaces = () => {
    fetch(`${API_BASE}/devices/${id}`)
      .then(res => res.json())
      .then(data => setDevice(data))
      .catch(err => console.error(err));

    fetch(`${API_BASE}/interfaces/${id}`)
      .then(res => res.json())
      .then(data => setInterfaces(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchDeviceAndInterfaces();
  }, [id]);


  const loadHistory = async (iface, date) => {
    if (!iface) return;
    try {
      const url = date ? `${API_BASE}/traffic/${id}/${iface.if_index}/history?date=${date}` : `${API_BASE}/traffic/${id}/${iface.if_index}/history`;
      const res = await fetch(url);
      const history = await res.json();
      if (Array.isArray(history)) {
        setTrafficData(history.map(h => ({ time: h.time, in: h.in_mbps, out: h.out_mbps })));
      }
    } catch (err) {
      console.error('Failed to load traffic history:', err);
    }
  };

  // Auto-refresh chart data
  useEffect(() => {
    if (selectedInterface && isPolling) {
      // Initial load
      loadHistory(selectedInterface, filterDate);
      // Set interval to just fetch history
      pollTimerRef.current = setInterval(() => {
        loadHistory(selectedInterface, filterDate);
      }, POLL_INTERVAL);
      
      return () => clearInterval(pollTimerRef.current);
    }
    
    return () => clearInterval(pollTimerRef.current);
  }, [selectedInterface, isPolling, filterDate, id]);

  // Reload history when date changes
  useEffect(() => {
    if (selectedInterface) {
      const isToday = filterDate === new Date().toISOString().split('T')[0];
      setIsPolling(isToday); // Auto-poll if it's today, stop if it's past
      loadHistory(selectedInterface, filterDate);
    }
  }, [filterDate]);

  // Load traffic history when selecting an interface
  const handleSelectInterface = async (iface) => {
    setSelectedInterface(iface);
    setTrafficData([]);
    
    const isToday = filterDate === new Date().toISOString().split('T')[0];
    setIsPolling(isToday); // Auto-start if today
    loadHistory(iface, filterDate);
  };

  const handleTogglePolling = () => {
    setIsPolling(prev => !prev);
  };

  const handleToggleStatus = (ifaceId) => {
    if (!selectedInterface) return;
    const newStatus = selectedInterface.admin_status === 'up' ? 'down' : 'up';
    
    // Call backend API to change status via SNMP SET
    fetch(`${API_BASE}/interfaces/${id}/${selectedInterface.if_index}/admin-status?status=${newStatus}`, {
      method: 'POST'
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert("Error: " + data.error);
        return;
      }
      // Update local state on success
      setInterfaces(interfaces.map(iface => {
        if (iface.id === ifaceId) {
          return { ...iface, admin_status: newStatus, oper_status: newStatus === 'up' ? 'up' : 'down' };
        }
        return iface;
      }));
      setSelectedInterface({ ...selectedInterface, admin_status: newStatus, oper_status: newStatus === 'up' ? 'up' : 'down' });
    })
    .catch(err => alert("Error setting status: " + err));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/devices" className="btn btn-ghost btn-circle">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-2xl font-bold">Device Details: {device?.name || `ID ${id}`}</h2>
          {device?.sys_name && (
            <p className="text-sm text-base-content/70 mt-1">Hostname: <span className="font-semibold">{device.sys_name}</span></p>
          )}
        </div>
      </div>

      {/* System Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat bg-base-100 shadow rounded-box">
          <div className="stat-figure text-primary"><Activity size={28} /></div>
          <div className="stat-title">Status</div>
          <div className="stat-value text-lg">{device?.status || 'UNKNOWN'}</div>
          <div className={`stat-desc ${device?.snmp_status === 'OK' ? 'text-success' : 'text-error'}`}>
            SNMP {device?.snmp_status || 'UNKNOWN'}
          </div>
        </div>
        <div className="stat bg-base-100 shadow rounded-box">
          <div className="stat-figure text-secondary"><Shield size={28} /></div>
          <div className="stat-title">System Object ID</div>
          <div className="stat-value text-sm leading-tight">
            {device?.sys_object_id_resolved || device?.sys_object_id || '-'}
          </div>
          {device?.sys_object_id && device?.sys_object_id_resolved && (
            <div className="stat-desc truncate" title={device.sys_object_id}>
              OID: {device.sys_object_id}
            </div>
          )}
        </div>
        <div className="stat bg-base-100 shadow rounded-box">
          <div className="stat-figure"><Clock size={28} /></div>
          <div className="stat-title">Uptime</div>
          <div className="stat-value text-lg">{device?.uptime || '-'}</div>
        </div>
        <div className="stat bg-base-100 shadow rounded-box">
          <div className="stat-figure text-info"><Server size={28} /></div>
          <div className="stat-title">System Description</div>
          <div className="stat-value text-xs leading-tight line-clamp-3" title={device?.sys_descr}>
            {device?.sys_descr || '-'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interfaces List */}
        <div className="lg:col-span-1 bg-base-100 shadow rounded-box p-4 h-[600px] flex flex-col">
          <h3 className="text-lg font-bold mb-4">Interfaces ({interfaces.length})</h3>
          <div className="overflow-y-auto flex-1 space-y-2 pr-2">
            {interfaces.length > 0 ? interfaces.map(iface => (
              <div 
                key={iface.id} 
                className={`p-3 border rounded-lg cursor-pointer hover:bg-base-200 transition-colors ${selectedInterface?.id === iface.id ? 'border-primary bg-base-200' : 'border-base-300'}`}
                onClick={() => handleSelectInterface(iface)}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold">{iface.name}</span>
                  <div className={`badge badge-sm ${iface.oper_status === 'up' ? 'badge-success' : 'badge-error'}`}>
                    {iface.oper_status}
                  </div>
                </div>
                <div className="text-xs text-base-content/60 truncate">{iface.description}</div>
              </div>
            )) : (
              <div className="text-center text-sm text-base-content/50 py-10">No interfaces found in DB. Auto-discovery (SNMP Walk) is required.</div>
            )}
          </div>
        </div>

        {/* Interface Details & Graph */}
        <div className="lg:col-span-2 bg-base-100 shadow rounded-box p-6 h-[600px] flex flex-col">
          {selectedInterface ? (
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">{selectedInterface.name}</h3>
                  <p className="text-sm text-base-content/70">{selectedInterface.description}</p>
                  <p className="text-sm text-base-content/70">IP Address: {selectedInterface.ip_address || 'Unassigned'}</p>
                  <p className="text-sm text-base-content/70">MAC: {selectedInterface.mac_address || 'N/A'}</p>
                  <p className="text-sm text-base-content/70">Speed: {selectedInterface.speed_bps ? (selectedInterface.speed_bps / 1000000).toFixed(0) : '?'} Mbps</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Admin Status:</span>
                    <input 
                      type="checkbox" 
                      className="toggle toggle-primary" 
                      checked={selectedInterface.admin_status === 'up'}
                      onChange={() => handleToggleStatus(selectedInterface.id)}
                    />
                  </div>
                  <span className="text-xs text-base-content/60">(SNMP SET to UP/DOWN)</span>
                </div>
              </div>

              {/* Traffic Controls */}
              <div className="flex items-center justify-between mb-4 p-3 bg-base-200 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Date:</span>
                    <input 
                      type="date" 
                      className="input input-sm input-bordered" 
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                    />
                  </div>
                  <button 
                    className={`btn btn-sm ${isPolling ? 'btn-error' : 'btn-success'}`}
                    onClick={handleTogglePolling}
                    disabled={filterDate !== new Date().toISOString().split('T')[0]} // Only allow polling for today
                    title={filterDate !== new Date().toISOString().split('T')[0] ? 'Live polling is only available for today' : ''}
                  >
                    <RefreshCw size={14} className={isPolling ? 'animate-spin' : ''} />
                    {isPolling ? 'Stop Polling' : 'Start Traffic Polling'}
                  </button>
                  <span className="text-xs text-base-content/60">
                    Auto-refresh: {POLL_INTERVAL / 1000}s
                  </span>
                </div>
              </div>

              <h4 className="font-semibold mb-2 text-center">Traffic Monitoring (Mbps)</h4>
              <div className="flex-1 w-full min-h-[250px]">
                {trafficData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trafficData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="time" tick={{ fontSize: 11 }} label={{ value: 'Time (HH:MM:SS)', position: 'insideBottomRight', offset: -10, fontSize: 12, fill: 'currentColor' }} />
                      <YAxis tick={{ fontSize: 11 }} label={{ value: 'Traffic (Mbps)', angle: -90, position: 'insideLeft', offset: -5, fontSize: 12, fill: 'currentColor' }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="in" name="Traffic In (RX)" stroke="#10b981" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="out" name="Traffic Out (TX)" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-base-content/50">
                    {isPolling ? 'Waiting for data...' : 'No data for this date.'}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-base-content/50">
              Select an interface from the list to view details and traffic
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeviceDetail;
