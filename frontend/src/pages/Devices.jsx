import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Activity, AlertCircle, RefreshCw } from 'lucide-react';

const Devices = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [snmpVersion, setSnmpVersion] = useState('v2c');
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingId, setCheckingId] = useState(null);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null, name: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const itemsPerPage = 6;

  const filteredDevices = devices.filter(dev => 
    dev.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    dev.ip.includes(searchQuery)
  );

  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentDevices = filteredDevices.slice(indexOfFirstItem, indexOfLastItem);

  const [formData, setFormData] = useState({
    name: '',
    ip: '',
    community_read: 'public',
    community_write: 'private',
    cli_username: '',
    cli_password: ''
  });

  const showNotification = (type, message) => {
    setNotification({ show: true, type, message });
  };

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

  const handleEditClick = (device) => {
    setIsEditMode(true);
    setEditingDeviceId(device.id);
    setFormData({ 
      name: device.name, 
      ip: device.ip, 
      community_read: device.community_read || 'public', 
      community_write: device.community_write || 'private',
      cli_username: device.cli_username || '',
      cli_password: device.cli_password || ''
    });
    setSnmpVersion(device.snmp_version || 'v2c');
    setShowAddModal(true);
  };

  const handleSaveDevice = async () => {
    setIsLoading(true);
    try {
      const payload = {
        name: formData.name,
        ip: formData.ip,
        snmp_version: snmpVersion,
        community_read: formData.community_read,
        community_write: formData.community_write,
        cli_username: formData.cli_username,
        cli_password: formData.cli_password
      };

      const url = isEditMode ? `http://localhost:8000/devices/${editingDeviceId}` : 'http://localhost:8000/devices/';
      const method = isEditMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const savedDevice = await res.json();
        // Trigger check device status immediately
        await checkDeviceStatus(savedDevice.id, true);
        setShowAddModal(false);
        setFormData({ name: '', ip: '', community_read: 'public', community_write: 'private', cli_username: '', cli_password: '' });
      } else {
        const errorData = await res.json();
        showNotification('error', `Failed to save device: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      showNotification('error', "Error adding device");
    }
    setIsLoading(false);
  };

  const confirmDeleteDevice = (device) => {
    setDeleteConfirm({ show: true, id: device.id, name: device.name });
  };

  const executeDeleteDevice = async () => {
    const id = deleteConfirm.id;
    setDeleteConfirm({ show: false, id: null, name: '' });
    try {
      const res = await fetch(`http://localhost:8000/devices/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchDevices();
        showNotification('success', 'Device deleted successfully.');
      } else {
        showNotification('error', "Failed to delete device");
      }
    } catch (err) {
      console.error(err);
      showNotification('error', "Error deleting device");
    }
  };

  const checkDeviceStatus = async (id, skipSuccessPopup = false) => {
    setCheckingId(id);
    try {
      const res = await fetch(`http://localhost:8000/devices/${id}/check`, { method: 'POST' });
      const data = await res.json();
      if (data.snmp_status === 'FAIL' || data.status === 'OFFLINE') {
        showNotification('error', `Warning: Device ${data.name || id} is unreachable via SNMP. Please verify IP and credentials.`);
      } else if (!skipSuccessPopup) {
        showNotification('success', `Success: Device ${data.name || id} is ONLINE and reachable.`);
      }
      fetchDevices(); // Refresh list after check
    } catch (err) {
      console.error("Error checking device", err);
      showNotification('error', "Timeout or Network error while checking device status.");
    }
    setCheckingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Devices</h2>
        <button className="btn btn-primary" onClick={() => {
          setIsEditMode(false);
          setEditingDeviceId(null);
          setFormData({ name: '', ip: '', community_read: 'public', community_write: 'private', cli_username: '', cli_password: '' });
          setSnmpVersion('v2c');
          setShowAddModal(true);
        }}>
          <Plus size={18} /> Add Device
        </button>
      </div>
      
      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="join">
          <input 
            className="input input-bordered join-item w-80" 
            placeholder="Search devices by name or IP..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
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
              <th>Protocol</th>
              <th>Reachability</th>
              <th>SNMP Status</th>
              <th>Uptime</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentDevices.map(dev => (
              <tr key={dev.id} className="hover">
                <td className="font-semibold">{dev.name}</td>
                <td>{dev.ip}</td>
                <td>
                  <div className={`badge ${dev.cli_protocol === 'SSH' ? 'badge-primary' : (dev.cli_protocol === 'Telnet' ? 'badge-warning' : 'badge-ghost')}`}>
                    {dev.cli_protocol || 'Unknown'}
                  </div>
                </td>
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
                    <button className="btn btn-xs btn-outline" onClick={() => checkDeviceStatus(dev.id)} disabled={checkingId === dev.id}>
                      {checkingId === dev.id ? <span className="loading loading-spinner loading-xs"></span> : 'Check'}
                    </button>
                    <Link to={`/devices/${dev.id}`} className="btn btn-xs btn-ghost">Details</Link>
                    <button className="btn btn-xs btn-info btn-outline" onClick={() => handleEditClick(dev)}>Edit</button>
                    <button className="btn btn-xs btn-error btn-outline" onClick={() => confirmDeleteDevice(dev)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {currentDevices.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center py-8 text-base-content/50">
                  No devices found. Click "Add Device" to add your EVE-NG lab devices.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-4">
          <div className="join">
            <button 
              className="join-item btn" 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              «
            </button>
            <button className="join-item btn">Page {currentPage} of {totalPages}</button>
            <button 
              className="join-item btn" 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              »
            </button>
          </div>
        </div>
      )}

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-2xl">
            <h3 className="font-bold text-lg mb-4">{isEditMode ? 'Edit Network Device' : 'Add Network Device'}</h3>
            
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

      {/* Notification Modal */}
      {notification.show && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className={`font-bold text-lg flex items-center gap-2 ${notification.type === 'error' ? 'text-error' : 'text-success'}`}>
              {notification.type === 'error' ? <AlertCircle /> : <Activity />}
              {notification.type === 'error' ? 'Warning / Error' : 'Success'}
            </h3>
            <p className="py-4 text-base">{notification.message}</p>
            <div className="modal-action">
              <button className="btn" onClick={() => setNotification({ ...notification, show: false })}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-error flex items-center gap-2">
              <AlertCircle />
              Confirm Deletion
            </h3>
            <p className="py-4 text-base">
              Are you sure you want to delete <span className="font-semibold">{deleteConfirm.name}</span> and all its interfaces? This action cannot be undone.
            </p>
            <div className="modal-action">
              <button className="btn" onClick={() => setDeleteConfirm({ show: false, id: null, name: '' })}>Cancel</button>
              <button className="btn btn-error" onClick={executeDeleteDevice}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Devices;
