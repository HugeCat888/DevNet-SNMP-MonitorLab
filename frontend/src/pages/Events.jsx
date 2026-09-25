import { useState, useEffect } from 'react';
import { Activity, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const formatOid = (oid) => {
  if (oid === '1.3.6.1.2.1.1.3.0') return 'sysUpTime';
  if (oid === '1.3.6.1.6.3.1.1.4.1.0') return 'snmpTrapOID';
  if (oid.startsWith('1.3.6.1.2.1.2.2.1.1.')) return 'ifIndex';
  if (oid.startsWith('1.3.6.1.2.1.2.2.1.2.')) return 'ifDescr';
  if (oid.startsWith('1.3.6.1.2.1.2.2.1.3.')) return 'ifType';
  if (oid.startsWith('1.3.6.1.2.1.2.2.1.7.')) return 'ifAdminStatus';
  if (oid.startsWith('1.3.6.1.2.1.2.2.1.8.')) return 'ifOperStatus';
  if (oid.startsWith('1.3.6.1.4.1.9.9.41.1.2.3.1.2.')) return 'clogHistFacility';
  if (oid.startsWith('1.3.6.1.4.1.9.9.41.1.2.3.1.3.')) return 'clogHistSeverity';
  if (oid.startsWith('1.3.6.1.4.1.9.9.41.1.2.3.1.4.')) return 'clogHistMsgName';
  if (oid.startsWith('1.3.6.1.4.1.9.9.41.1.2.3.1.5.')) return 'clogHistMsgText';
  if (oid.startsWith('1.3.6.1.4.1.9.9.41.1.2.3.1.6.')) return 'clogHistTimestamp';
  if (oid.startsWith('1.3.6.1.4.1.9.9.43.1.1.6.1.3.')) return 'ccmHistoryEventCommandSource';
  if (oid.startsWith('1.3.6.1.4.1.9.9.43.1.1.6.1.4.')) return 'ccmHistoryEventConfigSource';
  if (oid.startsWith('1.3.6.1.4.1.9.9.43.1.1.6.1.5.')) return 'ccmHistoryEventConfigDestination';
  
  if (oid === '1.3.6.1.6.3.1.1.5.1') return 'coldStart';
  if (oid === '1.3.6.1.6.3.1.1.5.2') return 'warmStart';
  if (oid === '1.3.6.1.6.3.1.1.5.3') return 'linkDown';
  if (oid === '1.3.6.1.6.3.1.1.5.4') return 'linkUp';
  if (oid === '1.3.6.1.6.3.1.1.5.5') return 'authenticationFailure';
  
  return oid;
};

const formatValue = (oid, value) => {
  if (oid === '1.3.6.1.6.3.1.1.4.1.0') return formatOid(value);
  if (oid.startsWith('1.3.6.1.2.1.2.2.1.7.') || oid.startsWith('1.3.6.1.2.1.2.2.1.8.')) {
    if (value === '1') return '1 (up)';
    if (value === '2') return '2 (down)';
    if (value === '3') return '3 (testing)';
  }
  return value;
};

const Events = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchEvents = () => {
    const url = filterDate ? `${API_BASE}/events?date=${filterDate}` : `${API_BASE}/events`;
    fetch(url)
      .then(res => res.json())
      .then(data => setEvents(data))
      .catch(err => console.error("Error fetching events", err));
  };

  useEffect(() => {
    fetchEvents();
    const timer = setInterval(fetchEvents, 5000); // Poll every 5 seconds
    return () => clearInterval(timer);
  }, [filterDate]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Activity size={24} /> Events & SNMP Traps
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
      
      <div className="bg-base-100 shadow rounded-box overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Time</th>
              <th>Source IP</th>
              <th>Event Type</th>
              <th>Interface</th>
              <th>Details & OID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map(ev => (
              <tr key={ev.id} className="hover">
                <td className="whitespace-nowrap">{ev.time}</td>
                <td className="font-semibold">{ev.device_ip}</td>
                <td>
                  <div className={`badge gap-1 ${
                    ev.event_type === 'LinkUp' ? 'badge-success' : 
                    ev.event_type === 'LinkDown' ? 'badge-error' : 
                    ev.event_type === 'SyslogMessage' ? 'badge-info' :
                    ev.event_type === 'ConfigChanged' ? 'badge-secondary' :
                    'badge-warning'
                  }`}>
                    {ev.event_type === 'LinkUp' && <ArrowUpCircle size={14} />}
                    {ev.event_type === 'LinkDown' && <ArrowDownCircle size={14} />}
                    {ev.event_type}
                  </div>
                </td>
                <td>{ev.if_name ? `${ev.if_name} (Idx: ${ev.if_index})` : (ev.if_index || '-')}</td>
                <td>
                  <div className="flex flex-col">
                    {ev.details ? (
                      <span className="font-semibold text-sm truncate max-w-xs" title={JSON.parse(ev.details).short_desc || 'No description'}>
                        {JSON.parse(ev.details).short_desc || 'No description available'}
                      </span>
                    ) : (
                      <span className="font-semibold text-sm">No description available</span>
                    )}
                    <span className="text-xs font-mono text-base-content/60">{ev.raw_oid || 'N/A'}</span>
                  </div>
                </td>
                <td>
                  <button 
                    className="btn btn-xs btn-outline" 
                    onClick={() => setSelectedEvent(ev)}
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center py-8 text-base-content/50">
                  No events recorded yet. Waiting for SNMP Traps from lab devices...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-3xl">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Activity /> Trap Details
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div><span className="font-semibold">Event Type:</span> {selectedEvent.event_type}</div>
              <div><span className="font-semibold">Source IP:</span> {selectedEvent.device_ip}</div>
              <div><span className="font-semibold">Time:</span> {selectedEvent.time}</div>
              <div><span className="font-semibold">Interface:</span> {selectedEvent.if_name ? `${selectedEvent.if_name} (Idx: ${selectedEvent.if_index})` : (selectedEvent.if_index || 'N/A')}</div>
              <div className="col-span-2"><span className="font-semibold">Raw Trap OID:</span> <span className="font-mono text-sm">{selectedEvent.raw_oid}</span></div>
            </div>

            <h4 className="font-semibold mb-2">VarBinds (SNMP Variables):</h4>
            <div className="bg-base-200 rounded-box p-4 overflow-x-auto max-h-64 overflow-y-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>OID Name</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEvent.details ? (
                    Object.entries(JSON.parse(selectedEvent.details).varbinds || {}).map(([oid, value], idx) => {
                      const oidName = formatOid(oid);
                      const formattedValue = formatValue(oid, value);
                      return (
                        <tr key={idx}>
                          <td className="font-mono text-xs">
                            {oidName !== oid ? <span className="font-semibold text-primary">{oidName}</span> : oidName}
                            {oidName !== oid && <div className="text-[10px] opacity-50">{oid}</div>}
                          </td>
                          <td className="font-mono text-xs text-base-content/80 break-words max-w-xs">{formattedValue}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan="2" className="text-center">No VarBinds recorded for this event.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-action">
              <button className="btn" onClick={() => setSelectedEvent(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
