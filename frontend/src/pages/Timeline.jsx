import React, { useEffect, useState, useMemo } from 'react';
import './Timeline.css';

function Timeline() {
  const [eventos, setEventos] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  const [ordemAsc, setOrdemAsc] = useState(true);

  const [pessoas, setPessoas] = useState([]);
  const [pessoasSelecionadas, setPessoasSelecionadas] = useState([]); 
  const [buscaParticipante, setBuscaParticipante] = useState(''); 
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const [ordemPessoasAsc, setOrdemPessoasAsc] = useState(true); 
  
  const [buscaEvento, setBuscaEvento] = useState(''); 
  const [inicioDia, setInicioDia] = useState('');
  const [inicioMes, setInicioMes] = useState('');
  const [inicioAno, setInicioAno] = useState('');
  const [fimDia, setFimDia] = useState('');
  const [fimMes, setFimMes] = useState('');
  const [fimAno, setFimAno] = useState('');

  const familiaAtiva = localStorage.getItem('familiaAtiva');
  const temFamilia = familiaAtiva && familiaAtiva !== 'undefined' && familiaAtiva !== 'null';

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'X-Familia-UUID': temFamilia ? familiaAtiva : ''
  });

  const formatarNomeApelido = (nomeCompleto, apelido) => {
    if (!nomeCompleto) return "";
    if (apelido && apelido.trim() !== "") {
      return `${nomeCompleto} (${apelido})`;
    }
    return nomeCompleto;
  };

  useEffect(() => {
    // PREVINE O ERRO 400 BLOQUEANDO O FETCH CASO NÃO EXISTA FAMÍLIA
    if (!temFamilia) {
      setLoading(false);
      return;
    }

    Promise.all([
      fetch('http://localhost:8000/api/pessoas/', { headers: getHeaders(), credentials: 'include' }).then(res => res.ok ? res.json() : []),
      fetch('http://localhost:8000/api/eventos/', { headers: getHeaders(), credentials: 'include' }).then(res => res.ok ? res.json() : [])
    ])
    .then(([pessoasData, eventosData]) => {
      if (Array.isArray(pessoasData)) setPessoas(pessoasData);
      if (Array.isArray(eventosData)) setEventos(eventosData);
      setLoading(false);
    })
    .catch(err => {
      console.error("Erro ao buscar timeline:", err);
      setLoading(false);
    });
  }, [familiaAtiva]);

  const eventosFiltrados = useMemo(() => {
    let resultado = [...eventos];

    if (buscaEvento.trim() !== '') {
      const termo = buscaEvento.toLowerCase();
      resultado = resultado.filter(evento => 
        evento.tipo && evento.tipo.toLowerCase().includes(termo)
      );
    }

    if (pessoasSelecionadas.length > 0) {
      resultado = resultado.filter(evento => {
        if (evento.participantes && evento.participantes.length > 0) {
          return pessoasSelecionadas.some(uuidSelecionado => 
            evento.participantes.some(p => p.uuid === uuidSelecionado)
          );
        }
        return false;
      });
    }

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

    resultado.sort((a, b) => {
      // Se não houver data, joga o evento para o final simulando uma data gigante
      const dataA = (a.data && !a.data.includes("desc")) ? a.data : "9999-99-99"; 
      const dataB = (b.data && !b.data.includes("desc")) ? b.data : "9999-99-99";
      
      // Compara alfabeticamente no formato YYYY-MM-DD
      return ordemAsc ? dataA.localeCompare(dataB) : dataB.localeCompare(dataA);
    });

    return resultado;
  }, [buscaEvento, pessoasSelecionadas, inicioDia, inicioMes, inicioAno, fimDia, fimMes, fimAno, eventos, ordemAsc]);

  const pessoasDropdown = pessoas
    .filter(p => formatarNomeApelido(p.nome, p.apelido).toLowerCase().includes(buscaParticipante.toLowerCase()))
    .sort((a, b) => {
      const nomeA = formatarNomeApelido(a.nome, a.apelido).toLowerCase();
      const nomeB = formatarNomeApelido(b.nome, b.apelido).toLowerCase();
      return ordemPessoasAsc ? nomeA.localeCompare(nomeB) : nomeB.localeCompare(nomeA);
    });

  const togglePessoa = (uuid) => {
    if (pessoasSelecionadas.includes(uuid)) {
      setPessoasSelecionadas(prev => prev.filter(id => id !== uuid)); 
    } else {
      setPessoasSelecionadas(prev => [...prev, uuid]); 
    }
  };

  const selecionarTodos = () => setPessoasSelecionadas(pessoas.map(p => p.uuid));
  const limparSelecao = () => setPessoasSelecionadas([]);

  const handleEventClick = (uuid) => {
    fetch(`http://localhost:8000/api/eventos/${uuid}/`, { headers: getHeaders(), credentials: 'include' })
      .then(res => res.json())
      .then(data => setSelectedEvent(data))
      .catch(err => console.error("Erro ao buscar detalhes:", err));
  };

  const limparFiltros = () => {
    setBuscaEvento('');
    setPessoasSelecionadas([]);
    setBuscaParticipante(''); 
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

        <div className="filter-group" style={{ position: 'relative' }}>
          <label>Participante:</label>
          
          <input 
            type="text"
            className="filter-input"
            value={buscaParticipante}
            onChange={(e) => setBuscaParticipante(e.target.value)}
            onFocus={() => setMostrarDropdown(true)}
            onBlur={() => setMostrarDropdown(false)} 
            placeholder="Pesquise o nome aqui..."
            style={{ minWidth: '280px' }}
          />

          <div style={{ marginTop: '5px', fontSize: '0.80rem', color: '#666', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {pessoasSelecionadas.length > 0 
              ? `Selecionados (${pessoasSelecionadas.length}): ${pessoasSelecionadas.map(id => {
                  const p = pessoas.find(x => x.uuid === id);
                  return p ? formatarNomeApelido(p.nome, p.apelido) : '';
                }).join(', ')}`
              : 'Nenhum participante filtrado.'}
          </div>
          
          {mostrarDropdown && (
            <div 
              onMouseDown={(e) => e.preventDefault()}
              style={{
                position: 'absolute',
                top: '70px',
                left: 0,
                width: '100%',
                backgroundColor: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                zIndex: 1000,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb', borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}>
                <div>
                  <button onClick={selecionarTodos} style={{ border: 'none', background: 'none', color: '#1877f2', cursor: 'pointer', fontSize: '0.85rem', marginRight: '10px' }}>Todos</button>
                  <button onClick={limparSelecao} style={{ border: 'none', background: 'none', color: '#e63946', cursor: 'pointer', fontSize: '0.85rem' }}>Nenhum</button>
                </div>
                <button onClick={() => setOrdemPessoasAsc(!ordemPessoasAsc)} style={{ border: 'none', background: 'none', color: '#555', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  {ordemPessoasAsc ? 'A-Z ↓' : 'Z-A ↑'}
                </button>
              </div>

              <ul style={{ maxHeight: '200px', overflowY: 'auto', listStyle: 'none', padding: 0, margin: 0 }}>
                {pessoasDropdown.length > 0 ? pessoasDropdown.map(p => (
                  <li 
                    key={p.uuid} 
                    onClick={() => togglePessoa(p.uuid)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f3f4f6',
                      fontSize: '0.90rem',
                      color: '#333',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <input 
                      type="checkbox" 
                      checked={pessoasSelecionadas.includes(p.uuid)} 
                      readOnly
                      style={{ cursor: 'pointer' }}
                    />
                    {formatarNomeApelido(p.nome, p.apelido)}
                  </li>
                )) : (
                  <li style={{ padding: '10px', color: '#999', textAlign: 'center', fontSize: '0.9rem' }}>Nenhum nome encontrado.</li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start', width: '100%' }}>
          
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

          <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto', alignSelf: 'flex-end', marginTop: '22px' }}>
            <button 
              className="btn-limpar" 
              onClick={() => setOrdemAsc(!ordemAsc)}
              style={{ backgroundColor: '#e2e8f0', color: '#333' }}
            >
              {ordemAsc ? "↓ Mais Antigos" : "↑ Mais Recentes"}
            </button>
            <button className="btn-limpar" onClick={limparFiltros}>
              Limpar Tudo
            </button>
          </div>

        </div>
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