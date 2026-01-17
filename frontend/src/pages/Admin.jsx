import React, { useState, useEffect } from 'react';
import './Admin.css';

function Admin() {
  const [activeTab, setActiveTab] = useState('pessoa'); // abas: pessoa, evento, relacao
  const [msg, setMsg] = useState('');

  // Estados para listas (Dropdowns)
  const [listaPessoas, setListaPessoas] = useState([]);
  const [listaEventos, setListaEventos] = useState([]);

  // --- STATE DOS FORMULÁRIOS ---
  
  // 1. Form Pessoa (Agora com campos de automação)
  const [formPessoa, setFormPessoa] = useState({ 
    nomeCompleto: '', 
    apelido: '', 
    dataNascimento: '',
    pai_uuid: '',       // Opcional
    mae_uuid: '',       // Opcional
    conjuge_uuid: '',   // Opcional
    dataCasamento: ''   // Opcional (Só se tiver cônjuge)
  });
  
  // 2. Form Evento
  const [formEvento, setFormEvento] = useState({ tipo: '', data: '', local: '', descricao: '' });

  // 3. Form Relacionamento Manual
  const [formRelacao, setFormRelacao] = useState({ origem_uuid: '', destino_uuid: '', tipo: 'PAI' });

  // --- BUSCA DADOS PARA DROPDOWNS ---
  const carregarDados = () => {
    // Usando localhost para padronizar cookies
    fetch('http://localhost:8000/api/pessoas/')
      .then(res => res.json())
      .then(data => setListaPessoas(data));
      
    fetch('http://localhost:8000/api/eventos/')
      .then(res => res.json())
      .then(data => setListaEventos(data));
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // --- HANDLERS DE SUBMIT ---

  const salvarPessoa = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:8000/api/pessoas/', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        credentials: 'include', // <--- Importante para Autoria
        body: JSON.stringify(formPessoa)
      });
      if(res.ok) {
        setMsg("✅ Pessoa cadastrada (e eventos gerados)!");
        // Limpa o formulário completo
        setFormPessoa({ 
            nomeCompleto: '', apelido: '', dataNascimento: '', 
            pai_uuid: '', mae_uuid: '', conjuge_uuid: '', dataCasamento: '' 
        });
        carregarDados(); // Atualiza lista imediatamente
      } else {
        const erro = await res.json();
        setMsg(`❌ Erro: ${erro.message || 'Falha ao salvar'}`);
      }
    } catch(err) { setMsg("Erro de conexão."); }
  };

  const salvarEvento = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:8000/api/eventos/', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        credentials: 'include',
        body: JSON.stringify(formEvento)
      });
      if(res.ok) {
        setMsg("✅ Evento criado com sucesso!");
        setFormEvento({ tipo: '', data: '', local: '', descricao: '' });
        carregarDados();
      } else {
        setMsg("❌ Erro ao criar evento.");
      }
    } catch(err) { setMsg("Erro de conexão."); }
  };

  const salvarRelacionamento = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:8000/api/relacionar/', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        credentials: 'include',
        body: JSON.stringify(formRelacao)
      });
      if(res.ok) {
        setMsg("🔗 Relacionamento criado!");
      } else {
        const erro = await res.json();
        setMsg(`❌ Erro: ${erro.message || 'Falha ao conectar'}`);
      }
    } catch(err) { setMsg("Erro de conexão."); }
  };

  return (
    <div className="admin-container">
      {/* ABAS DE NAVEGAÇÃO */}
      <div className="admin-tabs">
        <button 
          className={`tab-btn ${activeTab === 'pessoa' ? 'active' : ''}`}
          onClick={() => {setActiveTab('pessoa'); setMsg('');}}
        >
          👤 Nova Pessoa (Smart)
        </button>
        <button 
          className={`tab-btn ${activeTab === 'evento' ? 'active' : ''}`}
          onClick={() => {setActiveTab('evento'); setMsg('');}}
        >
          📅 Novo Evento
        </button>
        <button 
          className={`tab-btn ${activeTab === 'relacao' ? 'active' : ''}`}
          onClick={() => {setActiveTab('relacao'); setMsg('');}}
        >
          🔗 Criar Laços
        </button>
      </div>

      <div className="admin-content">
        {msg && <div className="success-msg">{msg}</div>}

        {/* --- ABA 1: FORMULÁRIO PESSOA AVANÇADO --- */}
        {activeTab === 'pessoa' && (
          <form onSubmit={salvarPessoa}>
            <h2 className="form-title">Cadastrar Familiar</h2>
            
            {/* DADOS BÁSICOS */}
            <div className="form-group">
              <label>Nome Completo</label>
              <input required type="text" value={formPessoa.nomeCompleto} 
                onChange={e => setFormPessoa({...formPessoa, nomeCompleto: e.target.value})} />
            </div>
            
            <div className="form-group" style={{display:'flex', gap:'20px'}}>
                <div style={{flex:1}}>
                    <label>Data de Nascimento</label>
                    <input required type="date" value={formPessoa.dataNascimento} 
                        onChange={e => setFormPessoa({...formPessoa, dataNascimento: e.target.value})} />
                </div>
                <div style={{flex:1}}>
                    <label>Apelido</label>
                    <input type="text" value={formPessoa.apelido} 
                        onChange={e => setFormPessoa({...formPessoa, apelido: e.target.value})} />
                </div>
            </div>

            <hr style={{margin:'25px 0', border:'0', borderTop:'1px solid #eee'}}/>
            <h3 style={{fontSize:'1.1rem', color:'#444', marginBottom:'15px'}}>Parentesco Automático (Opcional)</h3>

            {/* PAIS */}
            <div className="form-group" style={{display:'flex', gap:'20px'}}>
                <div style={{flex:1}}>
                    <label>Pai</label>
                    <select value={formPessoa.pai_uuid} onChange={e => setFormPessoa({...formPessoa, pai_uuid: e.target.value})}>
                        <option value="">-- Selecione --</option>
                        {listaPessoas.map(p => (
                            <option key={p.uuid} value={p.uuid}>{p.nome}</option>
                        ))}
                    </select>
                </div>
                <div style={{flex:1}}>
                    <label>Mãe</label>
                    <select value={formPessoa.mae_uuid} onChange={e => setFormPessoa({...formPessoa, mae_uuid: e.target.value})}>
                        <option value="">-- Selecione --</option>
                        {listaPessoas.map(p => (
                            <option key={p.uuid} value={p.uuid}>{p.nome}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* CÔNJUGE */}
            <div className="form-group">
                <label>Cônjuge (Marido/Esposa)</label>
                <select value={formPessoa.conjuge_uuid} onChange={e => setFormPessoa({...formPessoa, conjuge_uuid: e.target.value})}>
                    <option value="">-- Solteiro(a) ou Cônjuge não cadastrado --</option>
                    {listaPessoas.map(p => (
                        <option key={p.uuid} value={p.uuid}>{p.nome}</option>
                    ))}
                </select>
            </div>

            {/* DATA CASAMENTO - SÓ APARECE SE SELECIONAR CÔNJUGE */}
            {formPessoa.conjuge_uuid && (
                <div className="form-group" style={{background:'#f0f8ff', padding:'15px', borderRadius:'6px', border:'1px solid #cce5ff'}}>
                    <label style={{color:'#004085'}}>💍 Data do Casamento (Criará evento)</label>
                    <input type="date" value={formPessoa.dataCasamento} 
                        onChange={e => setFormPessoa({...formPessoa, dataCasamento: e.target.value})} />
                </div>
            )}

            <button type="submit" className="submit-btn" style={{marginTop:'10px'}}>
                Salvar Pessoa & Gerar Eventos
            </button>
          </form>
        )}

        {/* --- ABA 2: FORMULÁRIO EVENTO --- */}
        {activeTab === 'evento' && (
          <form onSubmit={salvarEvento}>
            <h2 className="form-title">Registrar Evento Histórico</h2>
            <div className="form-group">
              <label>Tipo do Evento</label>
              <input required type="text" placeholder="Ex: Formatura, Viagem, Batizado..." value={formEvento.tipo} 
                onChange={e => setFormEvento({...formEvento, tipo: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Data</label>
              <input required type="date" value={formEvento.data} 
                onChange={e => setFormEvento({...formEvento, data: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Local</label>
              <input type="text" value={formEvento.local} 
                onChange={e => setFormEvento({...formEvento, local: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Descrição / História</label>
              <textarea rows="4" value={formEvento.descricao} 
                onChange={e => setFormEvento({...formEvento, descricao: e.target.value})} />
            </div>
            <button type="submit" className="submit-btn">Salvar Evento</button>
          </form>
        )}

        {/* --- ABA 3: FORMULÁRIO RELACIONAMENTO MANUAL --- */}
        {activeTab === 'relacao' && (
          <form onSubmit={salvarRelacionamento}>
            <h2 className="form-title">Conectar Nós do Grafo (Manual)</h2>
            <p style={{marginBottom:'20px', color:'#666', fontSize:'0.9rem'}}>
                Use esta aba para correções ou para conectar pessoas a eventos específicos (Ex: "Foi na festa").
                Para parentescos diretos, prefira usar a aba "Nova Pessoa".
            </p>
            
            <div className="form-group">
              <label>Pessoa de Origem (Quem?)</label>
              <select required onChange={e => setFormRelacao({...formRelacao, origem_uuid: e.target.value})}>
                <option value="">Selecione...</option>
                {listaPessoas.map(p => (
                  <option key={p.uuid} value={p.uuid}>{p.nome}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Tipo de Relação</label>
              <select value={formRelacao.tipo} onChange={e => setFormRelacao({...formRelacao, tipo: e.target.value})}>
                <option value="PAI">É Pai de</option>
                <option value="MAE">É Mãe de</option>
                <option value="CASADO">É Casado com</option>
                <option value="FOI">Esteve no Evento (Participou)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Destino (Com quem / Onde?)</label>
              {formRelacao.tipo === 'FOI' ? (
                // Se for evento, mostra lista de eventos
                <select required onChange={e => setFormRelacao({...formRelacao, destino_uuid: e.target.value})}>
                  <option value="">Selecione o Evento...</option>
                  {listaEventos.map(e => (
                    <option key={e.uuid} value={e.uuid}>{e.data} - {e.tipo}</option>
                  ))}
                </select>
              ) : (
                // Se for parente, mostra lista de pessoas
                <select required onChange={e => setFormRelacao({...formRelacao, destino_uuid: e.target.value})}>
                  <option value="">Selecione a Pessoa...</option>
                  {listaPessoas.map(p => (
                    <option key={p.uuid} value={p.uuid}>{p.nome}</option>
                  ))}
                </select>
              )}
            </div>

            <button type="submit" className="submit-btn" style={{backgroundColor: '#1877f2'}}>Criar Conexão</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default Admin;