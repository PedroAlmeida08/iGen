import React, { useEffect, useState } from 'react';
import './Timeline.css';

function Timeline() {
  const [eventos, setEventos] = useState([]);
  const [eventosFiltrados, setEventosFiltrados] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filtro de Pessoas e Eventos
  const [pessoas, setPessoas] = useState([]);
  const [pessoaSelecionada, setPessoaSelecionada] = useState(''); 
  const [buscaEvento, setBuscaEvento] = useState(''); 
  
  // Filtros de Data: A PARTIR DE
  const [inicioDia, setInicioDia] = useState('');
  const [inicioMes, setInicioMes] = useState('');
  const [inicioAno, setInicioAno] = useState('');

  // Filtros de Data: ATÉ
  const [fimDia, setFimDia] = useState('');
  const [fimMes, setFimMes] = useState('');
  const [fimAno, setFimAno] = useState('');

  // Formata para "Nome Completo (Apelido)"
  const formatarNomeApelido = (nomeCompleto, apelido) => {
    if (!nomeCompleto) return "";
    if (apelido && apelido.trim() !== "") {
      return `${nomeCompleto} (${apelido})`;
    }
    return nomeCompleto;
  };

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/pessoas/')
      .then(res => res.json())
      .then(data => setPessoas(data))
      .catch(err => console.error("Erro ao buscar pessoas:", err));

    fetch('http://127.0.0.1:8000/api/eventos/')
      .then(res => res.json())
      .then(data => {
        const ordenados = data.sort((a, b) => new Date(a.data) - new Date(b.data));
        setEventos(ordenados);
        setEventosFiltrados(ordenados);
        setLoading(false);
      })
      .catch(err => console.error("Erro ao buscar timeline:", err));
  }, []);

  useEffect(() => {
    let resultado = eventos;

    // Filtro por Nome do Evento (Texto Livre)
    if (buscaEvento.trim() !== '') {
      const termo = buscaEvento.toLowerCase();
      resultado = resultado.filter(evento => 
        evento.tipo && evento.tipo.toLowerCase().includes(termo)
      );
    }

    // Filtro de Participante Cadastrado
    if (pessoaSelecionada !== '') {
      resultado = resultado.filter(evento => {
        if (evento.participantes && evento.participantes.length > 0) {
          return evento.participantes.some(p => p.uuid === pessoaSelecionada);
        }
        return false;
      });
    }

    // Filtro de Range de Data (A partir de / Até)
    const temFiltroData = inicioDia || inicioMes || inicioAno || fimDia || fimMes || fimAno;
    if (temFiltroData) {
      resultado = resultado.filter(evento => {
        if (!evento.data || evento.data.includes("desc")) return false; 

        const evData = evento.data; 

        const minAno = inicioAno ? inicioAno.padStart(4, '0') : '0000';
        const minMes = inicioMes ? inicioMes.padStart(2, '0') : '01';
        const minDia = inicioDia ? inicioDia.padStart(2, '0') : '01';
        const strInicio = `${minAno}-${minMes}-${minDia}`;

        const maxAno = fimAno ? fimAno.padStart(4, '0') : '9999';
        const maxMes = fimMes ? fimMes.padStart(2, '0') : '12';
        const maxDia = fimDia ? fimDia.padStart(2, '0') : '31';
        const strFim = `${maxAno}-${maxMes}-${maxDia}`;

        return evData >= strInicio && evData <= strFim;
      });
    }

    setEventosFiltrados(resultado);
  }, [buscaEvento, pessoaSelecionada, inicioDia, inicioMes, inicioAno, fimDia, fimMes, fimAno, eventos]);

  const handleEventClick = (uuid) => {
    fetch(`http://127.0.0.1:8000/api/eventos/${uuid}/`)
      .then(res => res.json())
      .then(data => {
        setSelectedEvent(data);
      })
      .catch(err => console.error("Erro ao buscar detalhes:", err));
  };

  const limparFiltros = () => {
    setBuscaEvento('');
    setPessoaSelecionada('');
    setInicioDia(''); setInicioMes(''); setInicioAno('');
    setFimDia(''); setFimMes(''); setFimAno('');
  };

  return (
    <div className="timeline-container">
      <h1 className="timeline-title">⏳ Linha do Tempo</h1>

      {/* ÁREA DE FILTROS */}
      <div className="timeline-filters">
        <div className="filter-group" style={{ width: '100%', marginBottom: '10px' }}>
          <label>Buscar Evento:</label>
          <input 
            type="text" 
            value={buscaEvento}
            onChange={(e) => setBuscaEvento(e.target.value)}
            className="filter-input"
            style={{ width: '100%' }}
          />
        </div>

        <div className="filter-group">
          <label>Participante:</label>
          <select 
            className="filter-input"
            value={pessoaSelecionada}
            onChange={(e) => setPessoaSelecionada(e.target.value)}
          >
            <option value="">Todos</option>
            {pessoas.map(p => (
              <option key={p.uuid} value={p.uuid}>
                {formatarNomeApelido(p.nome, p.apelido)}
              </option>
            ))}
          </select>
        </div>

        {/* CONTAINER FLEXÍVEL PARA FORÇAR AS DATAS NA MESMA LINHA */}
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          
          {/* Bloco: A Partir De */}
          <div className="filter-group" style={{ borderLeft: '2px solid #e0e0e0', paddingLeft: '15px' }}>
            <label style={{ color: '#1877f2' }}>A partir de:</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              <input type="number" placeholder="Dia" min="1" max="31" value={inicioDia} onChange={(e) => setInicioDia(e.target.value)} className="filter-input" style={{ width: '70px', minWidth: '70px' }} />
              <select className="filter-input" value={inicioMes} onChange={(e) => setInicioMes(e.target.value)} style={{ minWidth: '110px' }}>
                <option value="">Mês</option>
                <option value="1">Jan</option><option value="2">Fev</option><option value="3">Mar</option>
                <option value="4">Abr</option><option value="5">Mai</option><option value="6">Jun</option>
                <option value="7">Jul</option><option value="8">Ago</option><option value="9">Set</option>
                <option value="10">Out</option><option value="11">Nov</option><option value="12">Dez</option>
              </select>
              <input type="number" placeholder="Ano" value={inicioAno} onChange={(e) => setInicioAno(e.target.value)} className="filter-input" style={{ width: '80px', minWidth: '80px' }} />
            </div>
          </div>

          {/* Bloco: Até */}
          <div className="filter-group" style={{ borderLeft: '2px solid #e0e0e0', paddingLeft: '15px' }}>
            <label style={{ color: '#e67e22' }}>Até:</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              <input type="number" placeholder="Dia" min="1" max="31" value={fimDia} onChange={(e) => setFimDia(e.target.value)} className="filter-input" style={{ width: '70px', minWidth: '70px' }} />
              <select className="filter-input" value={fimMes} onChange={(e) => setFimMes(e.target.value)} style={{ minWidth: '110px' }}>
                <option value="">Mês</option>
                <option value="1">Jan</option><option value="2">Fev</option><option value="3">Mar</option>
                <option value="4">Abr</option><option value="5">Mai</option><option value="6">Jun</option>
                <option value="7">Jul</option><option value="8">Ago</option><option value="9">Set</option>
                <option value="10">Out</option><option value="11">Nov</option><option value="12">Dez</option>
              </select>
              <input type="number" placeholder="Ano" value={fimAno} onChange={(e) => setFimAno(e.target.value)} className="filter-input" style={{ width: '80px', minWidth: '80px' }} />
            </div>
          </div>

        </div>

        <button className="btn-limpar" onClick={limparFiltros} style={{ alignSelf: 'flex-end', marginLeft: 'auto' }}>
          Limpar
        </button>
      </div>

      {loading ? (
        <p style={{textAlign: 'center'}}>Carregando história...</p>
      ) : (
        <div className="timeline-list">
          {eventosFiltrados.length === 0 ? (
            <p style={{textAlign: 'center', color: '#888'}}>Nenhum evento encontrado para estes filtros.</p>
          ) : (
            eventosFiltrados.map((evento) => (
              <div key={evento.uuid} className="timeline-item" onClick={() => handleEventClick(evento.uuid)}>
                <div className="timeline-dot"></div>
                <div className="timeline-content">
                  <span className="timeline-date">
                    {evento.data && !evento.data.includes("desc") 
                      ? evento.data.split('-').reverse().join('/') 
                      : 'Data Desconhecida'}
                  </span>
                  <h3>{evento.tipo}</h3>
                  <p className="timeline-desc">
                    {evento.descricao 
                      ? (evento.descricao.length > 100 ? evento.descricao.substring(0, 100) + "..." : evento.descricao)
                      : "Clique para ver detalhes e participantes."}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* PAINEL LATERAL DE DETALHES DO EVENTO */}
      {selectedEvent && (
        <div className="details-panel">
          <div className="details-header" style={{display:'flex', justifyContent:'space-between'}}>
            <h2>{selectedEvent.tipo}</h2>
            <button className="close-btn" onClick={() => setSelectedEvent(null)} style={{border:'none', background:'none', fontSize:'1.5rem', cursor:'pointer'}}>×</button>
          </div>
          
          <p style={{color:'#666', fontWeight:'bold', marginTop:'10px'}}>
            📅 {selectedEvent.data && !selectedEvent.data.includes("desc") 
                  ? selectedEvent.data.split('-').reverse().join('/') 
                  : 'Data Desconhecida'}
          </p>
          
          <p style={{fontStyle:'italic', color:'#555', marginBottom:'20px'}}>📍 {selectedEvent.local || "Local não informado"}</p>

          <div style={{marginBottom:'20px', lineHeight:'1.6'}}>{selectedEvent.descricao || "Sem descrição adicional."}</div>

          <h4 style={{borderBottom:'1px solid #eee', paddingBottom:'5px', color:'#1877f2'}}>
            Quem participou ({selectedEvent.participantes.length})
          </h4>
          
          <ul style={{listStyle:'none', padding:0, marginTop:'10px'}}>
            {selectedEvent.participantes.length > 0 ? (
              selectedEvent.participantes.map(p => (
                <li key={p.uuid} style={{padding:'8px 0', borderBottom:'1px solid #f0f0f0'}}>
                  👤 {p.nome} {p.apelido ? `("${p.apelido}")` : ''}
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