import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactFlow, { Controls, Background, MarkerType, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import './Arvore.css';

// =========================================================
// MOTOR DE LAYOUT BÁSICO (DAGRE)
// =========================================================
const getLayoutedElements = (nodes, edges) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  dagreGraph.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100 });

  nodes.forEach((node) => {
    // Aumentamos levemente a altura para caber o apelido confortavelmente
    dagreGraph.setNode(node.id, { width: 160, height: 70 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: 'top',
      sourcePosition: 'bottom',
      position: {
        x: nodeWithPosition.x - 80,
        y: nodeWithPosition.y - 35,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

function Arvore() {
  const [grafoDados, setGrafoDados] = useState({ nodes: [], edges: [] });
  const [buscaNome, setBuscaNome] = useState('');
  
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  
  const [detalhes, setDetalhes] = useState(null);
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false);

  const reactFlowWrapper = useRef(null);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const carregarGrafo = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/grafo/');
      const data = await res.json();
      setGrafoDados(data);
    } catch (error) {
      console.error("Erro ao carregar o grafo:", error);
    }
  };

  useEffect(() => {
    carregarGrafo();
  }, []);

  useEffect(() => {
    if (grafoDados.nodes.length === 0) return;

    let nosBackend = grafoDados.nodes.filter(n => n.group === 'pessoa');
    
    let arestasBackend = grafoDados.edges.filter(e => {
      const fromExiste = nosBackend.find(n => n.id === e.from);
      const toExiste = nosBackend.find(n => n.id === e.to);
      return fromExiste && toExiste;
    });

    // --- APLICA FILTRO DE BUSCA (NOME OU APELIDO) ---
    if (buscaNome.trim() !== '') {
      const termo = buscaNome.toLowerCase();
      const pessoasEncontradas = nosBackend.filter(n => {
        const nomeMatch = n.label && n.label.toLowerCase().includes(termo);
        const apelidoMatch = n.apelido && n.apelido.toLowerCase().includes(termo);
        return nomeMatch || apelidoMatch;
      });
      
      const idsEncontrados = pessoasEncontradas.map(n => n.id);

      if (idsEncontrados.length > 0) {
        arestasBackend = arestasBackend.filter(e => idsEncontrados.includes(e.from) || idsEncontrados.includes(e.to));
        const idsConectados = new Set();
        arestasBackend.forEach(e => {
          idsConectados.add(e.from);
          idsConectados.add(e.to);
        });
        nosBackend = nosBackend.filter(n => idsConectados.has(n.id) || idsEncontrados.includes(n.id));
      } else {
        nosBackend = [];
        arestasBackend = [];
      }
    }

    // --- CONSTRUÇÃO DOS NÓS COM NOME E APELIDO ---
    let flowNodes = nosBackend.map(n => {
      const isPessoa = n.group === 'pessoa';
      
      return {
        id: n.id,
        data: { 
          // O label agora é um mini-componente JSX com o nome e o apelido
          label: (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <span>{n.label}</span>
              {n.apelido && (
                <span style={{ fontSize: '11px', fontWeight: '500', fontStyle: 'italic', color: '#6ea8f5' }}>
                  "{n.apelido}"
                </span>
              )}
            </div>
          ), 
          originalGroup: n.group 
        },
        style: {
          background: '#eef4ff',
          border: '2px solid #1877f2',
          borderRadius: '8px',
          width: 160,
          padding: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '13px',
          fontWeight: 'bold',
          textAlign: 'center',
          color: '#1877f2',
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
        }
      };
    });

    let flowEdges = arestasBackend.map(e => ({
      id: `e_${e.from}-${e.to}_${e.label}`,
      source: e.from,
      target: e.to,
      label: e.label,
      type: 'smoothstep',
      style: { stroke: '#999', strokeWidth: 1.5, strokeDasharray: e.label === 'CASADO' ? '5 5' : 'none' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#999' },
    }));

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(flowNodes, flowEdges);
    
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

  }, [grafoDados, buscaNome]);

  const onNodeClick = async (event, node) => {
    setCarregandoDetalhes(true);
    try {
      const res = await fetch(`http://localhost:8000/api/pessoas/${node.id}/`);
      const data = await res.json();
      setDetalhes({ ...data, tipo_entidade: 'pessoa' });
    } catch (error) {
      console.error("Erro ao buscar detalhes", error);
    }
    setCarregandoDetalhes(false);
  };

  return (
    <div className="arvore-page">
      <div className="arvore-toolbar">
        <h2>Árvore Genealógica</h2>
        <div className="toolbar-actions">
          <div className="search-box">
            <input 
              type="text" 
              placeholder="🔍 Filtrar por nome ou apelido..." 
              value={buscaNome}
              onChange={(e) => setBuscaNome(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="arvore-content">
        <div className="react-flow-container" ref={reactFlowWrapper} style={{ flex: 1, width: '100%', height: '100%' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            attributionPosition="bottom-left"
            minZoom={0.1}
          >
            <Background color="#f0f0f0" gap={20} />
            <Controls />
          </ReactFlow>
        </div>

        {detalhes && (
          <div className="sidebar-detalhes">
            <button className="btn-fechar" onClick={() => setDetalhes(null)}>✖</button>
            
            {carregandoDetalhes ? (
              <p>Carregando...</p>
            ) : (
              <div className="detalhes-info">
                <h3>👤 {detalhes.nome}</h3>
                {detalhes.apelido && <p className="badge">"{detalhes.apelido}"</p>}
                <p><strong>Nascimento:</strong> {detalhes.data_nascimento || 'Desconhecida'}</p>
                <p><strong>Registrado por:</strong> {detalhes.criado_por_nome}</p>
                
                <h4 className="mt-4">Eventos Presente:</h4>
                <ul className="lista-eventos">
                  {detalhes.eventos.length === 0 ? <li>Nenhum evento registrado.</li> : 
                    detalhes.eventos.map((ev, i) => (
                      <li key={i}><strong>{ev.data}</strong> - {ev.tipo}</li>
                    ))
                  }
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Arvore;