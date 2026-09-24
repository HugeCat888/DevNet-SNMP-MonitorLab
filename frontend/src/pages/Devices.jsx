import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Activity, AlertCircle, RefreshCw } from 'lucide-react';

const Devices = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [snmpVersion, setSnmpVersion] = useState('v2c');
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    ip: '',
    community_read: 'public',
    community_write: 'private'
  });

  const fetchDevices = () => {
    fetch('http://localhost:8000/devices/')
      .then(res => res.json())
      .then(data => setDevices(data))
      .catch(err => console.error("Error fetching devices", err));
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSaveDevice = async () => {
    setIsLoading(true);
    try {
      const payload = {
        name: formData.name,
        ip: formData.ip,
        snmp_version: snmpVersion,
        community_read: formData.community_read,
        community_write: formData.community_write
      };

      const res = await fetch('http://localhost:8000/devices/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const newDevice = await res.json();
        // Trigger check device status immediately
        await checkDeviceStatus(newDevice.id);
        setShowAddModal(false);
        setFormData({ name: '', ip: '', community_read: 'public', community_write: 'private' });
      } else {
        const errorData = await res.json();
        alert(`Failed to add device: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error adding device");
    }
    setIsLoading(false);
  };

  const deleteDevice = async (id) => {
    if (!confirm("Are you sure you want to delete this device and all its interfaces?")) return;
    try {
      const res = await fetch(`http://localhost:8000/devices/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchDevices();
      } else {
        alert("Failed to delete device");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting device");
    }
  };

  const checkDeviceStatus = async (id) => {
    try {
      await fetch(`http://localhost:8000/devices/${id}/check`, { method: 'POST' });
      fetchDevices(); // Refresh list after check
    } catch (err) {
      console.error("Error checking device", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Devices</h2>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={18} /> Add Device
        </button>
      </div>
      
      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="join">
          <input className="input input-bordered join-item w-80" placeholder="Search devices by name or IP..." />
          <button className="btn join-item"><Search size={18} /></button>
        </div>
        <button className="btn btn-ghost" onClick={fetchDevices}><RefreshCw size={18} /> Refresh</button>
      </div>

      {/* Device List */}
      <div className="bg-base-100 shadow-sm rounded-box overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>IP Address</th>
              <th>Reachability</th>
              <th>SNMP Status</th>
              <th>Uptime</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map(dev => (
              <tr key={dev.id} className="hover">
                <td className="font-semibold">{dev.name}</td>
                <td>{dev.ip}</td>
                <td>
                  <div className={`badge ${dev.status === 'ONLINE' ? 'badge-success' : (dev.status === 'OFFLINE' ? 'badge-error' : 'badge-ghost')} gap-1`}>
                    {dev.status === 'ONLINE' ? <Activity size={14} /> : <AlertCircle size={14} />}
                    {dev.status}
                  </div>
                </td>
                <td>
                  <div className={`badge badge-outline ${dev.snmp_status === 'OK' ? 'badge-success' : (dev.snmp_status === 'FAIL' ? 'badge-error' : 'badge-ghost')}`}>
                    {dev.snmp_status || dev.snmp}
                  </div>
                </td>
                <td className="text-sm">{dev.uptime || 'N/A'}</td>
                <td>
                  <div className="flex gap-2">
                    <button className="btn btn-xs btn-outline" onClick={() => checkDeviceStatus(dev.id)}>Check</button>
                    <Link to={`/devices/${dev.id}`} className="btn btn-xs btn-ghost">Details</Link>
                    <button className="btn btn-xs btn-error btn-outline" onClick={() => deleteDevice(dev.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center py-8 text-base-content/50">
                  No devices found. Click "Add Device" to add your EVE-NG lab devices.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Add Network Device</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label"><span className="label-text">Device Name</span></label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g. R1-Core" className="input input-bordered" />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Management IP</span></label>
                <input type="text" name="ip" value={formData.ip} onChange={handleInputChange} placeholder="192.168.215.132" className="input input-bordered" />
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text">SNMP Version</span></label>
                <select className="select select-bordered" value={snmpVersion} onChange={e => setSnmpVersion(e.target.value)}>
                  <option value="v2c">SNMP v2c</option>
                  <option value="v3">SNMP v3</option>
                </select>
              </div>

              {snmpVersion === 'v2c' ? (
                <>
                  <div className="form-control">
                    <label className="label"><span className="label-text">Read Community</span></label>
                    <input type="text" name="community_read" value={formData.community_read} onChange={handleInputChange} className="input input-bordered" />
                  </div>
                  <div className="form-control">
                    <label className="label"><span className="label-text">Write Community</span></label>
                    <input type="text" name="community_write" value={formData.community_write} onChange={handleInputChange} className="input input-bordered" />
                  </div>
                </>
              ) : (
                <div className="col-span-2 text-sm text-base-content/50 italic">
                  * SNMP v3 fields are hidden for simplicity in this demo.
                </div>
              )}
            </div>

            <div className="modal-action">
              <button className="btn" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveDevice} disabled={isLoading}>
                {isLoading ? <span className="loading loading-spinner"></span> : 'Save Device'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Devices;
