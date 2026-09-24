import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import DeviceDetail from './pages/DeviceDetail';
import Topology from './pages/Topology';
import Events from './pages/Events';
import Alerts from './pages/Alerts';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="devices" element={<Devices />} />
          <Route path="devices/:id" element={<DeviceDetail />} />
          <Route path="topology" element={<Topology />} />
          <Route path="events" element={<Events />} />
          <Route path="alerts" element={<Alerts />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
