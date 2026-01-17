import React, { useEffect, useState } from 'react';
import './Timeline.css';

function Timeline() {
  const [eventos, setEventos] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Carrega a lista simples de eventos
  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/eventos/')
      .then(res => res.json())
      .then(data => {
        setEventos(data);
        setLoading(false);
      })
      .catch(err => console.error("Erro ao buscar timeline:", err));
  }, []);

  // 2. Busca detalhes quando clica
  const handleEventClick = (uuid) => {
    fetch(`http://127.0.0.1:8000/api/eventos/${uuid}/`)
      .then(res => res.json())
      .then(data => {
        setSelectedEvent(data);
      })
      .catch(err => console.error("Erro ao buscar detalhes do evento:", err));
  };

  return (
    <div className="timeline-container">
      <h1 className="timeline-title">⏳ Linha do Tempo</h1>

      {loading ? (
        <p style={{textAlign: 'center'}}>Carregando história...</p>
      ) : (
        <div className="timeline-list">
          {eventos.map((evento) => (
            <div 
              key={evento.uuid} 
              className="timeline-item"
              onClick={() => handleEventClick(evento.uuid)}
            >
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <span className="timeline-date">{evento.data}</span>
                <h3>{evento.tipo}</h3>
                <p className="timeline-desc">
                  {evento.descricao 
                    ? (evento.descricao.length > 100 ? evento.descricao.substring(0, 100) + "..." : evento.descricao)
                    : "Clique para ver detalhes e participantes."}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PAINEL LATERAL DE DETALHES DO EVENTO */}
      {selectedEvent && (
        <div className="details-panel">
          <div className="details-header" style={{display:'flex', justifyContent:'space-between'}}>
            <h2>{selectedEvent.tipo}</h2>
            <button 
              className="close-btn" 
              onClick={() => setSelectedEvent(null)}
              style={{border:'none', background:'none', fontSize:'1.5rem', cursor:'pointer'}}
            >
              ×
            </button>
          </div>
          
          <p style={{color:'#666', fontWeight:'bold', marginTop:'10px'}}>
            📅 {selectedEvent.data}
          </p>
          
          <p style={{fontStyle:'italic', color:'#555', marginBottom:'20px'}}>
            📍 {selectedEvent.local || "Local não informado"}
          </p>

          <div style={{marginBottom:'20px', lineHeight:'1.6'}}>
            {selectedEvent.descricao || "Sem descrição adicional."}
          </div>

          <h4 style={{borderBottom:'1px solid #eee', paddingBottom:'5px', color:'#1877f2'}}>
            Quem participou ({selectedEvent.participantes.length})
          </h4>
          
          <ul style={{listStyle:'none', padding:0, marginTop:'10px'}}>
            {selectedEvent.participantes.length > 0 ? (
              selectedEvent.participantes.map(p => (
                <li key={p.uuid} style={{padding:'8px 0', borderBottom:'1px solid #f0f0f0'}}>
                  👤 {p.nome}
                </li>
              ))
            ) : (
              <li style={{color:'#999'}}>Ninguém vinculado ainda.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default Timeline;