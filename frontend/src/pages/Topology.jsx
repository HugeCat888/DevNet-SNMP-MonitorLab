import { useState, useCallback, useEffect } from 'react';
import { ReactFlow, Controls, Background, applyNodeChanges, applyEdgeChanges, MiniMap, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { RefreshCw, Server, Activity, AlertCircle } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

// Custom Node for ReactFlow
const DeviceNode = ({ data }) => {
  const isOnline = data.status === 'ONLINE';
  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-base-100 border-2 ${isOnline ? 'border-success' : 'border-error'}`}>
      <Handle type="target" position={Position.Top} className="w-16 !bg-primary" />
      <div className="flex items-center gap-2">
        {isOnline ? <Activity size={16} className="text-success" /> : <AlertCircle size={16} className="text-error" />}
        <div>
          <div className="font-bold text-sm">{data.label}</div>
          <div className="text-xs text-base-content/70">{data.ip}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-16 !bg-primary" />
    </div>
  );
};

const nodeTypes = { custom: DeviceNode };

const Topology = () => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTopology = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/topology`);
      const data = await res.json();
      
      // Map standard nodes to custom nodes
      const formattedNodes = data.nodes.map(n => ({
        ...n,
        type: 'custom',
        style: { width: 150 }
      }));
      
      setNodes(formattedNodes);
      setEdges(data.edges);
    } catch (err) {
      console.error('Error fetching topology:', err);
      alert('Failed to load topology.');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTopology();
  }, []);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Network Topology</h2>
        <button 
          className={`btn btn-outline btn-sm ${isLoading ? 'loading' : ''}`}
          onClick={fetchTopology}
          disabled={isLoading}
        >
          {isLoading ? <span className="loading loading-spinner loading-xs"></span> : <RefreshCw size={16} className="mr-2" />}
          {isLoading ? 'Discovering...' : 'Auto Discover'}
        </button>
      </div>
      
      <div className="bg-base-100 shadow rounded-box flex-1 min-h-[600px] border border-base-300">
        {nodes.length > 0 ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
            >
              <Background />
            <Controls />
            <MiniMap nodeStrokeColor="#4ade80" nodeColor="#e5e7eb" />
          </ReactFlow>
        ) : (
          <div className="flex h-full items-center justify-center text-base-content/50">
            No topology data available. Click "Auto Discover" to build topology from EVE-NG devices.
          </div>
        )}
      </div>
    </div>
  );
};

export default Topology;
