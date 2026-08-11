import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactFlow, { Controls, Background, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import './Arvore.css';
import PessoaNode from '../components/PessoaNode';

// Registrando os Custom Nodes para o React Flow
const nodeTypes = { pessoa: PessoaNode };

// =========================================================
// MOTOR DE LAYOUT (DAGRE)
// =========================================================
const getLayoutedElements = (nodes, edges) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // Aumentei o ranksep (distância vertical) para dar mais respiro aos galhos
  dagreGraph.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100 });

  nodes.forEach((node) => {
    // Ajustado para o novo tamanho do Custom Node
    if (node.id.startsWith('uniao_')) {
      dagreGraph.setNode(node.id, { width: 10, height: 10 });
    } else {
      dagreGraph.setNode(node.id, { width: 220, height: 70 });
    }
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target, { 
      minlen: edge.data?.minlen !== undefined ? edge.data.minlen : 1 
    });
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: 'top',
      sourcePosition: 'bottom',
      position: {
        x: nodeWithPosition.x - (node.id.startsWith('uniao_') ? 5 : 110),
        y: nodeWithPosition.y - (node.id.startsWith('uniao_') ? 5 : 35),
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

function Arvore() {
  const [grafoDados, setGrafoDados] = useState({ nodes: [], edges: [] });
  const [mostrarEventos, setMostrarEventos] = useState(false);
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

    let nosBackend = [...grafoDados.nodes];
    let arestasBackend = [...grafoDados.edges];

    // Elimina as linhas de irmãos para manter o layout limpo (Genograma)
    arestasBackend = arestasBackend.filter(e => e.label !== 'IRMAO');

    // Removemos os nós de evento fisicamente apenas se o toggle estiver desligado
    if (!mostrarEventos) {
      nosBackend = nosBackend.filter(n => n.group !== 'evento');
      const idsPermitidos = nosBackend.map(n => n.id);
      arestasBackend = arestasBackend.filter(e => 
        idsPermitidos.includes(e.from) && idsPermitidos.includes(e.to)
      );
    }

    let flowNodes = [];
    let flowEdges = [];
    const arestasParaRemover = new Set();
    const termoBusca = buscaNome.trim().toLowerCase();

    // =========================================================
    // MAPEAMENTO DOS NÓS
    // =========================================================
    nosBackend.forEach(n => {
      const isPessoa = n.group === 'pessoa';
      // Se não houver busca, todo mundo é "match". Se houver, verifica o nome.
      const isMatch = termoBusca === '' ? true : n.label.toLowerCase().includes(termoBusca);

      if (isPessoa) {
        flowNodes.push({
          id: n.id,
          type: 'pessoa', // Usa o nosso Custom Node!
          data: { 
            label: n.label, 
            apelido: n.apelido, 
            originalGroup: n.group,
            isMatch: isMatch 
          }
        });
      } else {
        // Nós de evento continuam como padrão, mas recebem estilo esmaecido na busca
        flowNodes.push({
          id: n.id,
          type: 'default',
          data: { label: n.label, originalGroup: n.group },
          style: {
            background: '#fff3e0',
            border: '2px solid #ff9800',
            borderRadius: '8px',
            padding: '10px',
            color: '#e65100',
            fontWeight: 'bold',
            opacity: isMatch ? 1 : 0.2, // Esmaece se não bater com a busca
            transition: 'opacity 0.3s ease'
          }
        });
      }
    });

    // =========================================================
    // MAPEAMENTO DAS ARESTAS (LINHAS)
    // =========================================================
    const casamentos = arestasBackend.filter(e => e.label === 'CASADO');
    
    casamentos.forEach(casamento => {
      const uniaoId = `uniao_${casamento.from}_${casamento.to}`;
      
      flowNodes.push({
        id: uniaoId,
        data: { label: '' },
        style: { width: 8, height: 8, background: '#94a3b8', border: 'none', borderRadius: '50%', padding: 0 }
      });

      flowEdges.push({ 
        id: `e_${casamento.from}-${uniaoId}`, 
        source: casamento.from, 
        target: uniaoId, 
        type: 'smoothstep', 
        data: { minlen: 0 }, 
        style: { stroke: '#cbd5e1', strokeWidth: 2 } 
      });
      
      flowEdges.push({ 
        id: `e_${casamento.to}-${uniaoId}`, 
        source: casamento.to, 
        target: uniaoId, 
        type: 'smoothstep', 
        data: { minlen: 0 }, 
        style: { stroke: '#cbd5e1', strokeWidth: 2 } 
      });
      
      arestasParaRemover.add(casamento);

      const filhosDoCasal = arestasBackend.filter(e => (e.from === casamento.from || e.from === casamento.to) && (e.label === 'PAI' || e.label === 'MAE'));
      const filhosIds = [...new Set(filhosDoCasal.map(e => e.to))];

      filhosIds.forEach(filhoId => {
        flowEdges.push({
          id: `e_${uniaoId}-${filhoId}`,
          source: uniaoId,
          target: filhoId,
          type: 'smoothstep', // Substituído de 'step' para 'smoothstep'
          style: { stroke: '#94a3b8', strokeWidth: 2 }
        });
      });

      filhosDoCasal.forEach(e => arestasParaRemover.add(e));
    });

    arestasBackend.forEach(e => {
      if (!arestasParaRemover.has(e)) {
        flowEdges.push({
          id: `e_${e.from}-${e.to}`,
          source: e.from,
          target: e.to,
          type: 'smoothstep', // Linhas mais orgânicas
          style: { stroke: '#cbd5e1', strokeWidth: 2 },
        });
      }
    });

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(flowNodes, flowEdges);
    
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

  }, [grafoDados, mostrarEventos, buscaNome]);

  const onNodeClick = async (event, node) => {
    // Ignora o clique se for o nó invisível de casamento
    if (node.id.startsWith('uniao_')) return;

    setCarregandoDetalhes(true);
    const tipo = node.data.originalGroup || 'evento';
    
    try {
      const endpoint = tipo === 'pessoa' ? `http://localhost:8000/api/pessoas/${node.id}/` : `http://localhost:8000/api/eventos/${node.id}/`;
      const res = await fetch(endpoint);
      const data = await res.json();
      setDetalhes({ ...data, tipo_entidade: tipo });
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
              placeholder="🔍 Filtrar por nome..." 
              value={buscaNome}
              onChange={(e) => setBuscaNome(e.target.value)}
            />
          </div>
          <label className="toggle-label">
            <input 
              type="checkbox" 
              checked={mostrarEventos} 
              onChange={(e) => setMostrarEventos(e.target.checked)} 
            />
            Mostrar Eventos
          </label>
        </div>
      </div>

      <div className="arvore-content">
        <div className="react-flow-container" ref={reactFlowWrapper} style={{ flex: 1, width: '100%', height: '100%' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes} // Injetando os nós customizados
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
            ) : detalhes.tipo_entidade === 'pessoa' ? (
              <div className="detalhes-info">
                <h3>👤 {detalhes.nome}</h3>
                {detalhes.apelido && <p className="badge">"{detalhes.apelido}"</p>}
                <p><strong>Nascimento:</strong> {detalhes.data_nascimento || 'Desconhecida'}</p>
                <p><strong>Registrado por:</strong> {detalhes.criado_por_nome}</p>
                
                <h4 className="mt-4">Eventos Presente:</h4>
                <ul className="lista-eventos">
                  {!detalhes.eventos || detalhes.eventos.length === 0 ? <li>Nenhum evento registrado.</li> : 
                    detalhes.eventos.map((ev, i) => (
                      <li key={i}><strong>{ev.data}</strong> - {ev.tipo}</li>
                    ))
                  }
                </ul>
              </div>
            ) : (
              <div className="detalhes-info evento">
                <h3>📅 {detalhes.tipo}</h3>
                <p><strong>Data:</strong> {detalhes.data}</p>
                <p><strong>Local:</strong> {detalhes.local}</p>
                {detalhes.descricao && <p className="descricao-box">{detalhes.descricao}</p>}
                
                <h4 className="mt-4">Participantes:</h4>
                <ul className="lista-participantes">
                  {!detalhes.participantes || detalhes.participantes.length === 0 ? <li>Nenhum participante.</li> : 
                    detalhes.participantes.map((p, i) => (
                      <li key={i}>{p.nome}</li>
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