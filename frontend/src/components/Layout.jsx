import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Server, Network, Activity, Bell } from 'lucide-react';

const Layout = () => {
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Devices', path: '/devices', icon: <Server size={20} /> },
    { name: 'Topology', path: '/topology', icon: <Network size={20} /> },
    { name: 'Events', path: '/events', icon: <Activity size={20} /> },
    { name: 'Alerts', path: '/alerts', icon: <Bell size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-base-200">
      {/* Sidebar */}
      <aside className="w-64 bg-base-100 flex flex-col border-r border-base-300">
        <div className="p-4 border-b border-base-300">
          <h1 className="text-xl font-bold text-primary">SNMP Monitor</h1>
        </div>
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="menu menu-md gap-2">
            {navItems.map((item) => (
              <li key={item.name}>
                <NavLink 
                  to={item.path} 
                  className={({ isActive }) => isActive ? "active" : ""}
                >
                  {item.icon}
                  {item.name}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-base-100 border-b border-base-300 flex items-center justify-between px-6">
          <div className="font-semibold text-lg text-base-content/70">
            {/* Can display current route name here if needed */}
          </div>
          <div className="flex items-center gap-4">
            {/* Admin dropdown removed */}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
