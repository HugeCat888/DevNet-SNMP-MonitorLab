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
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-ghost">
                Admin
                <svg width="12px" height="12px" className="h-2 w-2 fill-current opacity-60 inline-block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><path d="M1799 349l242 241-1017 1017L0 590l242-241 775 775 782-775z"></path></svg>
              </div>
              <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                <li><a>Profile</a></li>
                <li><a className="text-error">Logout</a></li>
              </ul>
            </div>
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
