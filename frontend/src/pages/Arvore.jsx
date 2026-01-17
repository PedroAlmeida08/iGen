    import React, { useEffect, useState } from 'react';
import Graph from 'react-graph-vis';
import './Arvore.css';

function Arvore() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [selectedPerson, setSelectedPerson] = useState(null); // Guarda os detalhes da pessoa clicada
  const [loading, setLoading] = useState(true);

  // --- CONFIGURAÇÃO VISUAL DO GRAFO ---
  const options = {
    layout: {
      hierarchical: false 
    },
    edges: {
      color: "#A0A0A0",
      arrows: { to: { enabled: true, scaleFactor: 0.5 } },
      smooth: { type: 'continuous' }
    },
    nodes: {
      shape: "dot",
      size: 20,
      font: { size: 14, strokeWidth: 2, strokeColor: "#fff" }
    },
    groups: {
      pessoa: { 
        color: { background: "#1877f2", border: "#0d5bc6" }, 
        font: { color: "#333" } 
      },
      evento: { 
        color: { background: "#e67e22", border: "#d35400" }, 
        shape: "diamond",
        size: 25
      }
    },
    physics: {
      enabled: true,
      stabilization: { iterations: 100 }
    },
    height: "100%", // Ocupa a altura do pai (.arvore-container)
    width: "100%"
  };

  // --- 1. BUSCAR DADOS DO GRAFO COMPLETO ---
  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/grafo/')
      .then(res => res.json())
      .then(data => {
        setGraphData(data);
        setLoading(false);
      })
      .catch(err => console.error("Erro ao carregar grafo:", err));
  }, []);

  // --- 2. QUANDO CLICAR NO NÓ ---
  const handleSelect = (event) => {
    const { nodes } = event;
    if (nodes.length === 0) {
      setSelectedPerson(null); // Clicou no vazio, fecha o painel
      return;
    }

    const nodeId = nodes[0];
    // Verifica se o nó clicado é uma PESSOA (temos essa info no graphData)
    const nodeData = graphData.nodes.find(n => n.id === nodeId);
    
    if (nodeData && nodeData.group === 'pessoa') {
        fetchDetails(nodeId);
    } else {
        // Se clicar num evento, por enquanto não fazemos nada ou mostramos algo simples
        console.log("Evento clicado:", nodeId);
    }
  };

  // --- 3. BUSCAR DETALHES DA PESSOA ---
  const fetchDetails = (uuid) => {
    fetch(`http://127.0.0.1:8000/api/pessoas/${uuid}/`)
      .then(res => res.json())
      .then(data => {
        setSelectedPerson(data); // Salva os dados completos (incluindo eventos)
      })
      .catch(err => console.error("Erro ao carregar detalhes:", err));
  };

  return (
    <div className="arvore-container">
      {loading ? (
        <p className="loading-msg">Carregando dados genealógicos...</p>
      ) : (
        <Graph
          graph={graphData}
          options={options}
          events={{ select: handleSelect }}
        />
      )}

      {/* PAINEL LATERAL DE DETALHES */}
      {selectedPerson && (
        <div className="details-panel">
          <div className="details-header">
            <h2>{selectedPerson.nome}</h2>
            <button className="close-btn" onClick={() => setSelectedPerson(null)}>×</button>
          </div>
          
          <div className="info-group">
            <div className="info-label">Apelido</div>
            <div className="info-value">{selectedPerson.apelido || "-"}</div>
          </div>
          
          <div className="info-group">
            <div className="info-label">Nascimento</div>
            <div className="info-value">{selectedPerson.data_nascimento || "Desconhecida"}</div>
          </div>

          <div className="info-group">
            <div className="info-label">Histórico de Eventos ({selectedPerson.eventos.length})</div>
            <div className="events-list">
              {selectedPerson.eventos.length > 0 ? (
                selectedPerson.eventos.map((ev, index) => (
                  <div key={index} className="event-item">
                    <span className="event-date">{ev.data}:</span> 
                    {ev.tipo}
                  </div>
                ))
              ) : (
                <p style={{fontSize: '0.8rem', color:'#999'}}>Nenhum evento registrado.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Arvore;