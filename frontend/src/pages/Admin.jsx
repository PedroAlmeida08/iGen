import React, { useState, useEffect } from 'react';
import './Admin.css';

function Admin({ user }) {
  const [activeTab, setActiveTab] = useState('pessoa'); 
  const [msg, setMsg] = useState('');

  // Listas de Dados
  const [listaPessoas, setListaPessoas] = useState([]);
  const [listaEventos, setListaEventos] = useState([]);
  const [listaLogs, setListaLogs] = useState([]);
  const [listaSolicitacoes, setListaSolicitacoes] = useState([]); 

  // Estados de Edição
  const [editandoPessoa, setEditandoPessoa] = useState(null);
  const [editandoEvento, setEditandoEvento] = useState(null);

  // --- STATE DOS FORMULÁRIOS (Create) ---
  const [formPessoa, setFormPessoa] = useState({ 
    nomeCompleto: '', apelido: '', dataNascimento: '',
    pai_uuid: '', mae_uuid: '', conjuge_uuid: '', dataCasamento: ''
  });
  const [formEvento, setFormEvento] = useState({ tipo: '', data: '', local: '', descricao: '' });
  const [formRelacao, setFormRelacao] = useState({ origem_uuid: '', destino_uuid: '', tipo: 'PAI' });

  // --- STATE DO MODAL DE SOLICITAÇÃO ---
  const [modalOpen, setModalOpen] = useState(false);
  const [solicitacaoAtual, setSolicitacaoAtual] = useState({
    tipo_acao: '', entidade: '', uuid_entidade: '', motivo: '', dados_novos: null
  });

  // --- BUSCA DADOS ---
  const carregarDados = () => {
    fetch('http://localhost:8000/api/pessoas/').then(res => res.json()).then(data => setListaPessoas(data));
    fetch('http://localhost:8000/api/eventos/').then(res => res.json()).then(data => setListaEventos(data));
  };

  const carregarDadosAdmin = async () => {
    if (user && user.is_admin) {
      try {
        const resLogs = await fetch('http://localhost:8000/api/logs/', { credentials: 'include' });
        if (resLogs.ok) setListaLogs(await resLogs.json());

        const resSol = await fetch('http://localhost:8000/api/solicitacoes/', { credentials: 'include' });
        if (resSol.ok) setListaSolicitacoes(await resSol.json());
      } catch (error) { console.error(error); }
    }
  };

  useEffect(() => {
    carregarDados();
    carregarDadosAdmin();
  }, [user]);

  // --- HANDLERS DE CRIAÇÃO ---
  const salvarPessoa = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:8000/api/pessoas/', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'include',
        body: JSON.stringify(formPessoa)
      });
      if(res.ok) {
        setMsg("✅ Pessoa cadastrada!");
        setFormPessoa({ nomeCompleto: '', apelido: '', dataNascimento: '', pai_uuid: '', mae_uuid: '', conjuge_uuid: '', dataCasamento: '' });
        carregarDados(); carregarDadosAdmin();
      } else { setMsg("❌ Erro ao salvar"); }
    } catch(err) { setMsg("Erro de conexão."); }
  };

  const salvarEvento = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:8000/api/eventos/', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'include',
        body: JSON.stringify(formEvento)
      });
      if(res.ok) {
        setMsg("✅ Evento criado!");
        setFormEvento({ tipo: '', data: '', local: '', descricao: '' });
        carregarDados(); carregarDadosAdmin();
      } else { setMsg("❌ Erro ao criar evento."); }
    } catch(err) { setMsg("Erro de conexão."); }
  };

  const salvarRelacionamento = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:8000/api/relacionar/', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'include',
        body: JSON.stringify(formRelacao)
      });
      if(res.ok) {
        setMsg("🔗 Relacionamento criado!"); carregarDadosAdmin();
      } else { setMsg("❌ Erro ao conectar"); }
    } catch(err) { setMsg("Erro de conexão."); }
  };

  // --- FLUXO DE SOLICITAÇÃO VS AÇÃO DIRETA ---
  const dispararAcaoExclusao = async (entidade, uuid) => {
    if (user && user.is_admin) {
      if (!window.confirm(`Admin: Tem certeza que deseja excluir este(a) ${entidade} permanentemente?`)) return;
      try {
        const url = entidade === 'Pessoa' ? `http://localhost:8000/api/pessoas/${uuid}/` : `http://localhost:8000/api/eventos/${uuid}/`;
        const res = await fetch(url, { method: 'DELETE', credentials: 'include' });
        if (res.ok) {
          setMsg(`🗑️ ${entidade} excluído(a) com sucesso.`);
          carregarDados(); carregarDadosAdmin();
        }
      } catch(err) { setMsg("Erro de conexão."); }
    } else {
      setSolicitacaoAtual({ tipo_acao: 'Excluir', entidade, uuid_entidade: uuid, motivo: '', dados_novos: null });
      setModalOpen(true);
    }
  };

  const dispararAcaoEdicao = async (e, entidade) => {
    e.preventDefault();
    const dados = entidade === 'Pessoa' ? editandoPessoa : editandoEvento;
    
    if (user && user.is_admin) {
      try {
        const url = entidade === 'Pessoa' ? `http://localhost:8000/api/pessoas/${dados.uuid}/` : `http://localhost:8000/api/eventos/${dados.uuid}/`;
        const res = await fetch(url, {
          method: 'PUT', headers: {'Content-Type': 'application/json'}, credentials: 'include', body: JSON.stringify(dados)
        });
        if (res.ok) {
          setMsg(`✅ ${entidade} atualizado(a) com sucesso!`);
          entidade === 'Pessoa' ? setEditandoPessoa(null) : setEditandoEvento(null);
          carregarDados(); carregarDadosAdmin();
        }
      } catch(err) { setMsg("Erro de conexão."); }
    } else {
      setSolicitacaoAtual({ tipo_acao: 'Editar', entidade, uuid_entidade: dados.uuid, motivo: '', dados_novos: dados });
      setModalOpen(true);
    }
  };

  const confirmarSolicitacao = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:8000/api/solicitacoes/', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'include',
        body: JSON.stringify(solicitacaoAtual)
      });
      if (res.ok) {
        setMsg("📩 Sua solicitação foi enviada para os administradores!");
        setModalOpen(false);
        setEditandoPessoa(null); setEditandoEvento(null);
      }
    } catch(err) { setMsg("Erro de conexão ao solicitar."); }
  };

  const julgarSolicitacao = async (id, acao) => {
    try {
      const res = await fetch(`http://localhost:8000/api/solicitacoes/${id}/`, {
        method: 'PUT', headers: {'Content-Type': 'application/json'}, credentials: 'include',
        body: JSON.stringify({ acao })
      });
      if (res.ok) {
        setMsg(acao === 'APROVAR' ? "✅ Solicitação Aprovada e Aplicada." : "❌ Solicitação Negada.");
        carregarDados(); carregarDadosAdmin();
      }
    } catch(err) { setMsg("Erro de conexão."); }
  };


  return (
    <div className="admin-container">
      {/* --- MODAL DE SOLICITAÇÃO --- */}
      {modalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{background: '#fff', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '500px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)'}}>
            <h3 style={{marginTop: 0, color: '#333'}}>Justifique a {solicitacaoAtual.tipo_acao}</h3>
            <p style={{color: '#666', fontSize: '0.9rem', marginBottom: '20px'}}>Como você não é administrador, esta ação requer aprovação.</p>
            <form onSubmit={confirmarSolicitacao}>
              <textarea 
                required rows="4" style={{width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', marginBottom: '15px'}}
                placeholder="Ex: Descobri que o ano de nascimento correto é 1950."
                value={solicitacaoAtual.motivo} onChange={e => setSolicitacaoAtual({...solicitacaoAtual, motivo: e.target.value})}
              />
              <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                <button type="button" onClick={() => setModalOpen(false)} style={{padding: '8px 15px', background: '#e0e0e0', border: 'none', borderRadius: '6px', cursor: 'pointer'}}>Cancelar</button>
                <button type="submit" style={{padding: '8px 15px', background: '#1877f2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer'}}>Enviar Pedido</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ABAS DE NAVEGAÇÃO */}
      <div className="admin-tabs">
        <button className={`tab-btn ${activeTab === 'pessoa' ? 'active' : ''}`} onClick={() => {setActiveTab('pessoa'); setMsg('');}}>👤 Nova Pessoa</button>
        <button className={`tab-btn ${activeTab === 'evento' ? 'active' : ''}`} onClick={() => {setActiveTab('evento'); setMsg('');}}>📅 Novo Evento</button>
        <button className={`tab-btn ${activeTab === 'relacao' ? 'active' : ''}`} onClick={() => {setActiveTab('relacao'); setMsg('');}}>🔗 Criar Laços</button>
        <button className={`tab-btn ${activeTab === 'gerenciar' ? 'active' : ''}`} onClick={() => {setActiveTab('gerenciar'); setMsg('');}}>📋 Gerenciar Dados</button>
        
        {/* ABAS EXCLUSIVAS DE ADMIN */}
        {user && user.is_admin && (
          <>
            <button className={`tab-btn ${activeTab === 'aprovacoes' ? 'active' : ''}`} onClick={() => {setActiveTab('aprovacoes'); setMsg(''); carregarDadosAdmin();}} style={{marginLeft: 'auto', backgroundColor: activeTab === 'aprovacoes' ? '#fff3e0' : 'transparent', color: activeTab === 'aprovacoes' ? '#e65100' : 'inherit'}}>
              🔔 Aprovações {listaSolicitacoes.length > 0 && `(${listaSolicitacoes.length})`}
            </button>
            <button className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => {setActiveTab('logs'); setMsg(''); carregarDadosAdmin();}}>
              📜 Auditoria
            </button>
          </>
        )}
      </div>

      <div className="admin-content">
        {msg && <div className="success-msg">{msg}</div>}

        {/* --- ABA 1: PESSOA --- */}
        {activeTab === 'pessoa' && (
           <form onSubmit={salvarPessoa}>
           <h2 className="form-title">Cadastrar Familiar</h2>
           <div className="form-group"><label>Nome</label><input required type="text" value={formPessoa.nomeCompleto} onChange={e => setFormPessoa({...formPessoa, nomeCompleto: e.target.value})} /></div>
           <div className="form-group" style={{display:'flex', gap:'20px'}}>
               <div style={{flex:1}}><label>Nascimento</label><input required type="date" value={formPessoa.dataNascimento} onChange={e => setFormPessoa({...formPessoa, dataNascimento: e.target.value})} /></div>
               <div style={{flex:1}}><label>Apelido</label><input type="text" value={formPessoa.apelido} onChange={e => setFormPessoa({...formPessoa, apelido: e.target.value})} /></div>
           </div>
           <button type="submit" className="submit-btn" style={{marginTop:'10px'}}>Salvar Pessoa</button>
         </form>
        )}

        {/* --- ABA 2: EVENTO --- */}
        {activeTab === 'evento' && (
           <form onSubmit={salvarEvento}>
           <h2 className="form-title">Registrar Evento Histórico</h2>
           <div className="form-group"><label>Tipo</label><input required type="text" value={formEvento.tipo} onChange={e => setFormEvento({...formEvento, tipo: e.target.value})} /></div>
           <div className="form-group"><label>Data</label><input required type="date" value={formEvento.data} onChange={e => setFormEvento({...formEvento, data: e.target.value})} /></div>
           <div className="form-group"><label>Local</label><input type="text" value={formEvento.local} onChange={e => setFormEvento({...formEvento, local: e.target.value})} /></div>
           <button type="submit" className="submit-btn">Salvar Evento</button>
         </form>
        )}

        {/* --- ABA 3: RELACIONAMENTO --- */}
        {activeTab === 'relacao' && (
          <form onSubmit={salvarRelacionamento}>
            <h2 className="form-title">Conectar Nós (Manual)</h2>
            <div className="form-group"><label>Origem</label><select required onChange={e => setFormRelacao({...formRelacao, origem_uuid: e.target.value})}><option value="">Selecione...</option>{listaPessoas.map(p => <option key={p.uuid} value={p.uuid}>{p.nome}</option>)}</select></div>
            <div className="form-group">
              <label>Relação</label>
              <select value={formRelacao.tipo} onChange={e => setFormRelacao({...formRelacao, tipo: e.target.value})}>
                <option value="PAI">É Pai de</option>
                <option value="MAE">É Mãe de</option>
                <option value="CASADO">É Casado com</option>
                <option value="IRMAO">É Irmã(o) de</option> {/* NOVO LAÇO AQUI */}
                <option value="FOI">Esteve no Evento</option>
              </select>
            </div>
            <div className="form-group"><label>Destino</label><select required onChange={e => setFormRelacao({...formRelacao, destino_uuid: e.target.value})}><option value="">Selecione...</option>{formRelacao.tipo === 'FOI' ? listaEventos.map(e => <option key={e.uuid} value={e.uuid}>{e.data} - {e.tipo}</option>) : listaPessoas.map(p => <option key={p.uuid} value={p.uuid}>{p.nome}</option>)}</select></div>
            <button type="submit" className="submit-btn" style={{backgroundColor: '#1877f2'}}>Criar Conexão</button>
          </form>
        )}

        {/* --- ABA 4: GERENCIAR --- */}
        {activeTab === 'gerenciar' && (
          <div>
            <h2 className="form-title">Gerenciar Registros</h2>
            <p style={{color: '#666', marginBottom: '20px'}}>{user && user.is_admin ? "Como admin, suas edições são imediatas." : "Você pode solicitar edições que serão revisadas pelos administradores."}</p>

            <h3 style={{marginBottom: '10px', color: '#333'}}>Pessoas</h3>
            <div style={{overflowX: 'auto', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', marginBottom: '30px'}}>
              <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem'}}>
                <thead>
                  <tr style={{background: '#f8f9fa', borderBottom: '2px solid #dee2e6'}}>
                    <th style={{padding: '12px', whiteSpace: 'nowrap'}}>Nome</th>
                    <th style={{padding: '12px', whiteSpace: 'nowrap'}}>Apelido</th>
                    <th style={{padding: '12px', textAlign: 'right', whiteSpace: 'nowrap'}}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {listaPessoas.map(p => (
                    <tr key={p.uuid} style={{borderBottom: '1px solid #e9ecef'}}>
                      {editandoPessoa && editandoPessoa.uuid === p.uuid ? (
                        <td colSpan="3" style={{padding: '12px', background: '#f5f5f5'}}>
                          <form onSubmit={(e) => dispararAcaoEdicao(e, 'Pessoa')} style={{display: 'flex', gap: '10px'}}>
                            <input type="text" value={editandoPessoa.nomeCompleto} onChange={e => setEditandoPessoa({...editandoPessoa, nomeCompleto: e.target.value})} style={{padding: '6px', flex: 2}} required/>
                            <input type="text" value={editandoPessoa.apelido || ''} onChange={e => setEditandoPessoa({...editandoPessoa, apelido: e.target.value})} placeholder="Apelido" style={{padding: '6px', flex: 1}}/>
                            <button type="submit" style={{background: '#1877f2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '0 15px'}}>{user && user.is_admin ? "Salvar" : "Solicitar Alteração"}</button>
                            <button type="button" onClick={() => setEditandoPessoa(null)} style={{background: '#9e9e9e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '0 15px'}}>Cancelar</button>
                          </form>
                        </td>
                      ) : (
                        <>
                          <td style={{padding: '12px', whiteSpace: 'nowrap'}}>{p.nome}</td>
                          <td style={{padding: '12px', whiteSpace: 'nowrap'}}>{p.apelido || '-'}</td>
                          <td style={{padding: '12px', textAlign: 'right', whiteSpace: 'nowrap'}}>
                            <button onClick={() => setEditandoPessoa({uuid: p.uuid, nomeCompleto: p.nome, apelido: p.apelido})} style={{padding: '5px 10px', marginRight: '5px', background: '#ffb300', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>Editar</button>
                            <button onClick={() => dispararAcaoExclusao('Pessoa', p.uuid)} style={{padding: '5px 10px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>Excluir</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 style={{marginBottom: '10px', color: '#333'}}>Eventos</h3>
            <div style={{overflowX: 'auto', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>
              <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem'}}>
                <thead>
                  <tr style={{background: '#f8f9fa', borderBottom: '2px solid #dee2e6'}}>
                    <th style={{padding: '12px', whiteSpace: 'nowrap'}}>Tipo</th>
                    <th style={{padding: '12px', whiteSpace: 'nowrap'}}>Data</th>
                    <th style={{padding: '12px', whiteSpace: 'nowrap'}}>Local</th>
                    <th style={{padding: '12px', textAlign: 'right', whiteSpace: 'nowrap'}}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {listaEventos.map(e => (
                    <tr key={e.uuid} style={{borderBottom: '1px solid #e9ecef'}}>
                      {editandoEvento && editandoEvento.uuid === e.uuid ? (
                        <td colSpan="4" style={{padding: '12px', background: '#f5f5f5'}}>
                          <form onSubmit={(ev) => dispararAcaoEdicao(ev, 'Evento')} style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                            <input type="text" value={editandoEvento.tipo} onChange={ev => setEditandoEvento({...editandoEvento, tipo: ev.target.value})} style={{padding: '6px', flex: 1}} required placeholder="Tipo (Ex: Casamento)"/>
                            <input type="text" value={editandoEvento.local || ''} onChange={ev => setEditandoEvento({...editandoEvento, local: ev.target.value})} style={{padding: '6px', flex: 1}} placeholder="Local"/>
                            <button type="submit" style={{background: '#1877f2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '0 15px'}}>{user && user.is_admin ? "Salvar" : "Solicitar Alteração"}</button>
                            <button type="button" onClick={() => setEditandoEvento(null)} style={{background: '#9e9e9e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '0 15px'}}>Cancelar</button>
                          </form>
                        </td>
                      ) : (
                        <>
                          <td style={{padding: '12px', fontWeight: 'bold', whiteSpace: 'nowrap'}}>{e.tipo}</td>
                          <td style={{padding: '12px', whiteSpace: 'nowrap'}}>{e.data}</td>
                          <td style={{padding: '12px', whiteSpace: 'nowrap'}}>{e.local || '-'}</td>
                          <td style={{padding: '12px', textAlign: 'right', whiteSpace: 'nowrap'}}>
                            <button onClick={() => setEditandoEvento({uuid: e.uuid, tipo: e.tipo, local: e.local})} style={{padding: '5px 10px', marginRight: '5px', background: '#ffb300', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>Editar</button>
                            <button onClick={() => dispararAcaoExclusao('Evento', e.uuid)} style={{padding: '5px 10px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>Excluir</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- ABA 5: APROVAÇÕES --- */}
        {activeTab === 'aprovacoes' && (
          <div>
            <h2 className="form-title">Pedidos de Moderação</h2>
            {listaSolicitacoes.length === 0 ? <p style={{color: '#666'}}>Não há solicitações pendentes no momento.</p> : (
              <div style={{display: 'grid', gap: '15px'}}>
                {listaSolicitacoes.map(sol => (
                  <div key={sol.id} style={{background: '#fff', borderLeft: sol.tipo_acao === 'Excluir' ? '5px solid #d32f2f' : '5px solid #1877f2', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <h4 style={{margin: 0, color: '#333'}}>👤 {sol.usuario} deseja <strong>{sol.tipo_acao}</strong> um(a) {sol.entidade}</h4>
                      <span style={{fontSize: '0.8rem', color: '#888'}}>{sol.data_solicitacao}</span>
                    </div>
                    <p style={{margin: '10px 0', color: '#555'}}><strong>Motivo:</strong> "{sol.motivo}"</p>
                    <div style={{display: 'flex', gap: '10px'}}>
                      <button onClick={() => julgarSolicitacao(sol.id, 'APROVAR')} style={{padding: '8px 15px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>Aprovar e Aplicar</button>
                      <button onClick={() => julgarSolicitacao(sol.id, 'NEGAR')} style={{padding: '8px 15px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>Negar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- ABA 6: LOGS --- */}
        {activeTab === 'logs' && (
          <div>
            <h2 className="form-title">Auditoria (Logs)</h2>
            <div style={{overflowX: 'auto', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>
              <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem'}}>
                <thead>
                  <tr style={{background: '#f8f9fa', borderBottom: '2px solid #dee2e6'}}>
                    {/* whiteSpace: 'nowrap' forçará a tabela a não quebrar linhas nesses campos */}
                    <th style={{padding: '12px 15px', whiteSpace: 'nowrap'}}>Data/Hora</th>
                    <th style={{padding: '12px 15px', whiteSpace: 'nowrap'}}>Usuário</th>
                    <th style={{padding: '12px 15px', whiteSpace: 'nowrap'}}>Ação</th>
                    <th style={{padding: '12px 15px', whiteSpace: 'nowrap'}}>Entidade</th>
                    <th style={{padding: '12px 15px', width: '100%'}}>Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {listaLogs.length === 0 ? <tr><td colSpan="5" style={{padding: '20px', textAlign: 'center'}}>Nenhum registro.</td></tr> : listaLogs.map(log => (
                      <tr key={log.id} style={{borderBottom: '1px solid #e9ecef'}}>
                        <td style={{padding: '12px 15px', whiteSpace: 'nowrap'}}>{log.data_hora}</td>
                        <td style={{padding: '12px 15px', fontWeight: 'bold', whiteSpace: 'nowrap'}}>{log.usuario}</td>
                        <td style={{padding: '12px 15px', whiteSpace: 'nowrap'}}>
                          <span style={{padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: log.acao === 'Excluiu' ? '#ffebee' : log.acao === 'Editou' ? '#e3f2fd' : '#e8f5e9', color: log.acao === 'Excluiu' ? '#c62828' : log.acao === 'Editou' ? '#1565c0' : '#2e7d32'}}>{log.acao}</span>
                        </td>
                        <td style={{padding: '12px 15px', whiteSpace: 'nowrap'}}>{log.entidade}</td>
                        <td style={{padding: '12px 15px', color: '#555'}}>{log.detalhes}</td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Admin;