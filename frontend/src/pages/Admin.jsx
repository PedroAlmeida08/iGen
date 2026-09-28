import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import './Admin.css';

function Admin({ user, familias }) {
  const familiaAtiva = localStorage.getItem('familiaAtiva');
  const temFamilia = Boolean(familiaAtiva && familiaAtiva !== 'undefined' && familiaAtiva !== 'null' && familiaAtiva !== '');
  const familiaObj = familias?.find(f => f.uuid === familiaAtiva) || (temFamilia && familias ? familias[0] : null);
  
  // Apenas superusuários têm poder administrativo total
  const isSuperuser = Boolean(user?.is_superuser);
  const isFamiliaAdmin = Boolean(isSuperuser || (familiaObj && familiaObj.funcao === 'ADMIN'));
  const isLeitor = !isSuperuser && familiaObj?.funcao === 'LEITOR';
  const isAdmin = isSuperuser;

  const [activeTab, setActiveTab] = useState(() => {
    if (!isSuperuser) return 'pessoa';
    return temFamilia ? 'pessoa' : 'aprovacoes';
  }); 
  const [msg, setMsg] = useState('');

  const [listaPessoas, setListaPessoas] = useState([]);
  const [listaEventos, setListaEventos] = useState([]);
  const [listaLogs, setListaLogs] = useState([]);
  const [listaSolicitacoes, setListaSolicitacoes] = useState([]); 
  const [listaMembros, setListaMembros] = useState([]);

  const [editandoPessoa, setEditandoPessoa] = useState(null);
  const [editandoEvento, setEditandoEvento] = useState(null);

  const [formPessoa, setFormPessoa] = useState({ 
    nomeCompleto: '', apelido: '', dataNascimento: '', dataObito: '', 
    pai_uuid: '', mae_uuid: '', conjuge_uuid: '', dataCasamento: ''
  });
  const [formEvento, setFormEvento] = useState({ tipo: '', data: '', local: '', descricao: '' });
  const [formRelacao, setFormRelacao] = useState({ origem_uuid: '', destino_uuid: '', tipo: 'PAI' });

  // Criação direta de família pelo Admin
  const [nomeDiretoFamilia, setNomeDiretoFamilia] = useState('');
  const [funcaoDiretaFamilia, setFuncaoDiretaFamilia] = useState('ADMIN');
  const [criandoFamiliaDireta, setCriandoFamiliaDireta] = useState(false);
  const [funcaoSelecionadaPorFamilia, setFuncaoSelecionadaPorFamilia] = useState({});

  const [modalOpen, setModalOpen] = useState(false);
  const [solicitacaoAtual, setSolicitacaoAtual] = useState({
    tipo_acao: '', entidade: '', uuid_entidade: '', motivo: '', dados_novos: null
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const atualizarTabelas = () => setRefreshKey(prev => prev + 1);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'X-Familia-UUID': temFamilia ? familiaAtiva : ''
  });

  // Redireciona usuários comuns para fora de abas exclusivas
  useEffect(() => {
    if (!isSuperuser && ['aprovacoes', 'familias', 'logs'].includes(activeTab)) {
      setActiveTab('pessoa');
    }
    if (!isFamiliaAdmin && activeTab === 'membros') {
      setActiveTab('pessoa');
    }
  }, [isSuperuser, isFamiliaAdmin, activeTab]);

  // Carregamento de dados reagindo a mudanças de contexto e refreshKey
  useEffect(() => {
    const headersJSON = { 
      'Content-Type': 'application/json', 
      'X-Familia-UUID': temFamilia ? familiaAtiva : '' 
    };

    if (temFamilia) {
      fetch(`${API_BASE_URL}/api/pessoas/`, { headers: headersJSON, credentials: 'include' })
        .then(res => res.ok ? res.json() : [])
        .then(data => setListaPessoas(Array.isArray(data) ? data : []))
        .catch(err => console.error("Erro Pessoas:", err));

      fetch(`${API_BASE_URL}/api/eventos/`, { headers: headersJSON, credentials: 'include' })
        .then(res => res.ok ? res.json() : [])
        .then(data => setListaEventos(Array.isArray(data) ? data : []))
        .catch(err => console.error("Erro Eventos:", err));
    } else {
      setListaPessoas([]);
      setListaEventos([]);
    }

    if (isSuperuser) {
      fetch(`${API_BASE_URL}/api/logs/`, { headers: headersJSON, credentials: 'include' })
        .then(res => res.ok ? res.json() : [])
        .then(data => setListaLogs(Array.isArray(data) ? data : []))
        .catch(err => console.error("Erro Admin Logs:", err));

      fetch(`${API_BASE_URL}/api/solicitacoes/`, { headers: headersJSON, credentials: 'include' })
        .then(res => res.ok ? res.json() : [])
        .then(data => setListaSolicitacoes(Array.isArray(data) ? data : []))
        .catch(err => console.error("Erro Admin Solicitações:", err));
    } else {
      setListaLogs([]);
      setListaSolicitacoes([]);
    }

    if (isFamiliaAdmin && temFamilia) {
      fetch(`${API_BASE_URL}/api/membros/`, { headers: headersJSON, credentials: 'include' })
        .then(res => res.ok ? res.json() : [])
        .then(data => setListaMembros(Array.isArray(data) ? data : []))
        .catch(err => console.error("Erro Admin Membros:", err));
    } else {
      setListaMembros([]);
    }
  }, [refreshKey, temFamilia, familiaAtiva, isSuperuser, isFamiliaAdmin]);

  const alterarFuncaoMembro = async (membroId, novaFuncao) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/membros/${membroId}/funcao/`, {
        method: 'PUT',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ funcao: novaFuncao })
      });
      if (res.ok) {
        const data = await res.json();
        setMsg(`✅ ${data.message || 'Função atualizada com sucesso!'}`);
        atualizarTabelas();
      } else {
        const errText = await res.text();
        setMsg(`❌ Erro ao alterar função: ${errText}`);
      }
    } catch (err) {
      console.error(err);
      setMsg("Erro de conexão ao alterar função.");
    }
  };

  if (isLeitor) {
    return (
      <div className="admin-container">
        <div style={{
          backgroundColor: '#fff3cd',
          color: '#856404',
          border: '1px solid #ffeeba',
          padding: '2.5rem',
          borderRadius: '8px',
          textAlign: 'center',
          maxWidth: '650px',
          margin: '3rem auto',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          <h2 style={{ marginBottom: '1rem', color: '#856404' }}>🔒 Acesso Restrito</h2>
          <p style={{ fontSize: '1.1rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            Usuários com a função de <strong>Leitor</strong> não possuem permissão para acessar a área de Gestão.
          </p>
        </div>
      </div>
    );
  }


  const salvarPessoa = async (e) => {
    e.preventDefault();
    if (!temFamilia) {
      setMsg("⚠️ Selecione uma família antes de criar uma pessoa.");
      return;
    }
    if (isAdmin) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/pessoas/`, {
          method: 'POST', headers: getHeaders(), credentials: 'include',
          body: JSON.stringify(formPessoa)
        });
        if(res.ok) {
          setMsg("✅ Pessoa e eventos registrados!");
          setFormPessoa({ nomeCompleto: '', apelido: '', dataNascimento: '', dataObito: '', pai_uuid: '', mae_uuid: '', conjuge_uuid: '', dataCasamento: '' });
          atualizarTabelas();
        } else { 
          const errData = await res.text();
          setMsg(`❌ Erro ao salvar: ${errData}`); 
        }
      } catch(err) { 
        console.error(err); 
        setMsg("Erro de conexão."); 
      }
    } else {
      setSolicitacaoAtual({
        tipo_acao: 'Criar',
        entidade: 'Pessoa',
        uuid_entidade: '',
        motivo: '',
        dados_novos: formPessoa
      });
      setModalOpen(true);
    }
  };

  const salvarEvento = async (e) => {
    e.preventDefault();
    if (!temFamilia) {
      setMsg("⚠️ Selecione uma família antes de criar um evento.");
      return;
    }
    if (isAdmin) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/eventos/`, {
          method: 'POST', headers: getHeaders(), credentials: 'include',
          body: JSON.stringify(formEvento)
        });
        if(res.ok) {
          setMsg("✅ Evento criado!");
          setFormEvento({ tipo: '', data: '', local: '', descricao: '' });
          atualizarTabelas();
        } else { 
          const errData = await res.text();
          setMsg(`❌ Erro ao salvar: ${errData}`); 
        }
      } catch(err) { 
        console.error(err); 
        setMsg("Erro de conexão."); 
      }
    } else {
      setSolicitacaoAtual({
        tipo_acao: 'Criar',
        entidade: 'Evento',
        uuid_entidade: '',
        motivo: '',
        dados_novos: formEvento
      });
      setModalOpen(true);
    }
  };

  const salvarRelacionamento = async (e) => {
    e.preventDefault();
    if (!temFamilia) {
      setMsg("⚠️ Selecione uma família antes de criar laços.");
      return;
    }
    if (isAdmin) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/relacionar/`, {
          method: 'POST', headers: getHeaders(), credentials: 'include',
          body: JSON.stringify(formRelacao)
        });
        if(res.ok) {
          setMsg("✅ Conexão estabelecida!");
          setFormRelacao({ origem_uuid: '', destino_uuid: '', tipo: 'PAI' });
          atualizarTabelas();
        } else { 
          const errData = await res.text();
          setMsg(`❌ Erro ao conectar: ${errData}`); 
        }
      } catch(err) { 
        console.error(err); 
        setMsg("Erro de conexão."); 
      }
    } else {
      setSolicitacaoAtual({
        tipo_acao: 'Criar',
        entidade: 'Relacionamento',
        uuid_entidade: '',
        motivo: '',
        dados_novos: formRelacao
      });
      setModalOpen(true);
    }
  };

  const dispararAcaoExclusao = async (entidade, uuid) => {
    if (isAdmin) {
      if(!window.confirm(`Tem certeza que deseja excluir este(a) ${entidade}?`)) return;
      const url = entidade === 'Pessoa' 
        ? `${API_BASE_URL}/api/pessoas/${uuid}/` 
        : `${API_BASE_URL}/api/eventos/${uuid}/`;

      try {
        const res = await fetch(url, { method: 'DELETE', headers: getHeaders(), credentials: 'include' });
        if(res.ok) {
          setMsg(`✅ ${entidade} excluído(a) com sucesso!`);
          atualizarTabelas();
        } else { 
          setMsg(`❌ Erro ao excluir.`);
        }
      } catch(err) { 
        console.error(err); 
        setMsg("Erro de conexão."); 
      }
    } else {
      setSolicitacaoAtual({
        tipo_acao: 'Excluir',
        entidade: entidade,
        uuid_entidade: uuid,
        motivo: '',
        dados_novos: null
      });
      setModalOpen(true);
    }
  };

  const dispararAcaoEdicao = async (e, entidade) => {
    e.preventDefault();
    const dados = entidade === 'Pessoa' ? editandoPessoa : editandoEvento;

    if (isAdmin) {
      const url = entidade === 'Pessoa' 
        ? `${API_BASE_URL}/api/pessoas/${dados.uuid}/` 
        : `${API_BASE_URL}/api/eventos/${dados.uuid}/`;

      try {
        const res = await fetch(url, {
          method: 'PUT', headers: getHeaders(), credentials: 'include',
          body: JSON.stringify(dados)
        });
        if(res.ok) {
          setMsg(`✅ ${entidade} atualizado(a) com sucesso!`);
          setEditandoPessoa(null);
          setEditandoEvento(null);
          atualizarTabelas();
        } else { 
          setMsg(`❌ Erro ao atualizar.`);
        }
      } catch(err) { 
        console.error(err); 
        setMsg("Erro de conexão."); 
      }
    } else {
      setSolicitacaoAtual({
        tipo_acao: 'Editar',
        entidade: entidade,
        uuid_entidade: dados.uuid,
        motivo: '',
        dados_novos: dados
      });
      setModalOpen(true);
    }
  };

  const confirmarSolicitacao = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/solicitacoes/`, {
        method: 'POST', headers: getHeaders(), credentials: 'include',
        body: JSON.stringify(solicitacaoAtual)
      });
      if(res.ok) {
        setMsg("📨 Solicitação enviada com sucesso aos administradores!");
        setModalOpen(false);
        setSolicitacaoAtual({ tipo_acao: '', entidade: '', uuid_entidade: '', motivo: '', dados_novos: null });
        if (solicitacaoAtual.tipo_acao === 'Criar') {
          if (solicitacaoAtual.entidade === 'Pessoa') {
            setFormPessoa({ nomeCompleto: '', apelido: '', dataNascimento: '', dataObito: '', pai_uuid: '', mae_uuid: '', conjuge_uuid: '', dataCasamento: '' });
          } else if (solicitacaoAtual.entidade === 'Evento') {
            setFormEvento({ tipo: '', data: '', local: '', descricao: '' });
          } else if (solicitacaoAtual.entidade === 'Relacionamento') {
            setFormRelacao({ origem_uuid: '', destino_uuid: '', tipo: 'PAI' });
          }
        }
        setEditandoPessoa(null); 
        setEditandoEvento(null);
      } else {
        const errText = await res.text();
        setMsg(`❌ Erro ao solicitar: ${errText}`);
      }
    } catch(err) { 
      console.error(err); 
      setMsg("Erro de conexão ao solicitar."); 
    }
  };

  const julgarSolicitacao = async (id, acao) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/solicitacoes/${id}/`, {
        method: 'PUT', headers: getHeaders(), credentials: 'include',
        body: JSON.stringify({ acao })
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(data.message || (acao === 'APROVAR' ? "✅ Solicitação Aprovada e Aplicada." : "❌ Solicitação Negada."));
        atualizarTabelas();
        // Se aprovou uma nova família, recarrega para atualizar a navbar e listas
        if (data.message && data.message.includes('Família')) {
          setTimeout(() => {
            window.location.reload();
          }, 1200);
        }
      } else {
        setMsg(`❌ Erro: ${data.message || 'Erro ao processar solicitação.'}`);
      }
    } catch(err) { 
      console.error(err); 
      setMsg("Erro de conexão."); 
    }
  };

  const handleCriarFamiliaAdmin = async (e) => {
    e.preventDefault();
    if (!nomeDiretoFamilia) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/familias/criar/`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ nome: nomeDiretoFamilia, funcao: funcaoDiretaFamilia })
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`✅ Família '${nomeDiretoFamilia}' criada com sucesso!`);
        setNomeDiretoFamilia('');
        setFuncaoDiretaFamilia('ADMIN');
        setCriandoFamiliaDireta(false);
        localStorage.setItem('familiaAtiva', data.uuid);
        window.location.reload();
      } else {
        setMsg(`❌ Erro: ${data.message || 'Erro ao criar família.'}`);
      }
    } catch (err) {
      console.error(err);
      setMsg("Erro de conexão ao criar família.");
    }
  };

  const handleEntrarFamiliaAdmin = async (uuid, nome) => {
    const funcaoDesejada = funcaoSelecionadaPorFamilia[uuid] || 'ADMIN';
    try {
      const res = await fetch(`${API_BASE_URL}/api/familias/entrar/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ familia_uuid: uuid, funcao: funcaoDesejada })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('familiaAtiva', uuid);
        window.location.reload();
      } else {
        setMsg(`❌ Erro: ${data.message || 'Erro ao entrar na família.'}`);
      }
    } catch (err) {
      console.error(err);
      setMsg("Erro de conexão ao entrar na família.");
    }
  };

  const excluirFamilia = async (uuid, nome) => {
    if (!window.confirm(`⚠️ ATENÇÃO: Tem certeza de que deseja excluir permanentemente a família "${nome}"?\n\nEsta ação apagará todos os membros, pessoas, eventos e laços vinculados a ela no banco de dados e no grafo Neo4j!`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/familias/${uuid}/`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(data.message || `✅ Família "${nome}" excluída com sucesso!`);
        if (localStorage.getItem('familiaAtiva') === uuid) {
          localStorage.removeItem('familiaAtiva');
        }
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setMsg(`❌ Erro ao excluir: ${data.message || 'Falha na exclusão.'}`);
      }
    } catch (err) {
      console.error("Erro ao excluir família:", err);
      setMsg("Erro de conexão ao excluir família.");
    }
  };

  if (!isAdmin && !temFamilia) {
    return (
      <div style={{padding: '50px', textAlign: 'center'}}>
        <h2>Acesso à Gestão</h2>
        <p style={{color: '#666', marginTop: '10px'}}>
          Você ainda não pertence a nenhuma família. Solicite a criação de uma família
        </p>
        <button
          onClick={() => window.location.href = '/login'}
          style={{marginTop: '15px', padding: '8px 16px', background: '#1877f2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'}}
        >
          Solicitar Criação de Família
        </button>
      </div>
    );
  }

  return (
    <div className="admin-container">
      {modalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', 
          justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', padding: '25px', borderRadius: '8px', 
            maxWidth: '500px', width: '90%', boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{marginTop: 0, color: '#1877f2'}}>Confirmar Solicitação</h3>
            <p style={{color: '#555', fontSize: '0.9rem'}}>
              Você está solicitando a ação de <strong>{solicitacaoAtual.tipo_acao}</strong> em <strong>{solicitacaoAtual.entidade}</strong>.
              Explique o motivo para que os administradores possam avaliar sua solicitação:
            </p>
            <form onSubmit={confirmarSolicitacao}>
              <textarea 
                required rows="4" 
                style={{
                  width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', marginBottom: '15px',
                  backgroundColor: '#ffffff', color: '#333333'
                }}
                placeholder={solicitacaoAtual.tipo_acao === 'Criar' 
                  ? "Ex: Descreva o motivo da inclusão deste registro na árvore familiar." 
                  : "Ex: Descobri que o ano de nascimento correto é 1950."}
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

      <div className="admin-tabs">
        <button className={`tab-btn ${activeTab === 'pessoa' ? 'active' : ''}`} onClick={() => {setActiveTab('pessoa'); setMsg('');}}>👤 Nova Pessoa</button>
        <button className={`tab-btn ${activeTab === 'evento' ? 'active' : ''}`} onClick={() => {setActiveTab('evento'); setMsg('');}}>📅 Novo Evento</button>
        <button className={`tab-btn ${activeTab === 'relacao' ? 'active' : ''}`} onClick={() => {setActiveTab('relacao'); setMsg('');}}>🔗 Criar Laços</button>
        <button className={`tab-btn ${activeTab === 'gerenciar' ? 'active' : ''}`} onClick={() => {setActiveTab('gerenciar'); setMsg('');}}>📋 Gerenciar Dados</button>
        
        {isSuperuser && (
          <>
            <button className={`tab-btn ${activeTab === 'aprovacoes' ? 'active' : ''}`} onClick={() => {setActiveTab('aprovacoes'); setMsg(''); atualizarTabelas();}} style={{marginLeft: 'auto', backgroundColor: activeTab === 'aprovacoes' ? '#fff3e0' : 'transparent', color: activeTab === 'aprovacoes' ? '#e65100' : 'inherit'}}>
              🔔 Aprovações {listaSolicitacoes.length > 0 && `(${listaSolicitacoes.length})`}
            </button>
            <button className={`tab-btn ${activeTab === 'familias' ? 'active' : ''}`} onClick={() => {setActiveTab('familias'); setMsg('');}}>
              🏢 Famílias ({familias?.length || 0})
            </button>
            {temFamilia && (
              <button className={`tab-btn ${activeTab === 'membros' ? 'active' : ''}`} onClick={() => {setActiveTab('membros'); setMsg(''); atualizarTabelas();}}>
                👥 Membros ({listaMembros.length})
              </button>
            )}
            <button className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => {setActiveTab('logs'); setMsg(''); atualizarTabelas();}}>
              📜 Auditoria
            </button>
          </>
        )}
        {!isSuperuser && isFamiliaAdmin && temFamilia && (
          <button className={`tab-btn ${activeTab === 'membros' ? 'active' : ''}`} onClick={() => {setActiveTab('membros'); setMsg(''); atualizarTabelas();}} style={{marginLeft: 'auto'}}>
            👥 Membros ({listaMembros.length})
          </button>
        )}
      </div>

      <div className="admin-content">
        {msg && <div className="success-msg">{msg}</div>}

        {/* Banner para quando o Admin está na Visão Geral (sem família selecionada) */}
        {!temFamilia && ['pessoa', 'evento', 'relacao', 'gerenciar'].includes(activeTab) && (
          <div style={{padding: '30px', textAlign: 'center', background: '#fff', borderRadius: '8px', border: '1px solid #ffe0b2', margin: '10px 0 25px 0'}}>
            <h3 style={{color: '#e65100', marginTop: 0}}>🌐 Nenhuma Família Ativa Selecionada</h3>
            <p style={{color: '#666', maxWidth: '600px', margin: '10px auto'}}>
              Você está na Visão Geral de Moderação. Para cadastrar ou editar registros desta aba, selecione uma família na barra superior ou na aba <strong>Famílias</strong>.
            </p>
            <button 
              onClick={() => setActiveTab('familias')} 
              style={{padding: '8px 16px', background: '#1877f2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'}}
            >
              Ir para a aba Famílias
            </button>
          </div>
        )}

        {temFamilia && activeTab === 'pessoa' && (
           <form onSubmit={salvarPessoa}>
             <h2 className="form-title">Cadastrar Familiar ({familiaObj?.nome || 'Família'})</h2>
             <div className="form-group">
               <label>Nome *</label>
               <input required type="text" value={formPessoa.nomeCompleto} onChange={e => setFormPessoa({...formPessoa, nomeCompleto: e.target.value})} />
             </div>
             <div className="form-group" style={{display:'flex', gap:'20px'}}>
                 <div style={{flex:1}}>
                   <label>Nascimento *</label>
                   <input required type="date" value={formPessoa.dataNascimento} onChange={e => setFormPessoa({...formPessoa, dataNascimento: e.target.value})} />
                 </div>
                 <div style={{flex:1}}>
                   <label>Óbito (Opcional)</label>
                   <input type="date" value={formPessoa.dataObito} onChange={e => setFormPessoa({...formPessoa, dataObito: e.target.value})} />
                 </div>
                 <div style={{flex:1}}>
                   <label>Apelido</label>
                   <input type="text" value={formPessoa.apelido} onChange={e => setFormPessoa({...formPessoa, apelido: e.target.value})} />
                 </div>
             </div>
             <button type="submit" className="submit-btn" style={{marginTop:'10px'}}>{isAdmin ? "Salvar Pessoa" : "Solicitar Cadastro de Pessoa"}</button>
           </form>
        )}

        {temFamilia && activeTab === 'evento' && (
           <form onSubmit={salvarEvento}>
           <h2 className="form-title">Registrar Evento Histórico ({familiaObj?.nome || 'Família'})</h2>
           <div className="form-group"><label>Tipo *</label><input required type="text" value={formEvento.tipo} onChange={e => setFormEvento({...formEvento, tipo: e.target.value})} /></div>
           <div className="form-group"><label>Data *</label><input required type="date" value={formEvento.data} onChange={e => setFormEvento({...formEvento, data: e.target.value})} /></div>
           <div className="form-group"><label>Local</label><input type="text" value={formEvento.local} onChange={e => setFormEvento({...formEvento, local: e.target.value})} /></div>
           <button type="submit" className="submit-btn">{isAdmin ? "Salvar Evento" : "Solicitar Criação de Evento"}</button>
         </form>
        )}

        {temFamilia && activeTab === 'relacao' && (
          <form onSubmit={salvarRelacionamento}>
            <h2 className="form-title">Conectar Nós (Manual) ({familiaObj?.nome || 'Família'})</h2>
            <div className="form-group"><label>Origem</label><select required onChange={e => setFormRelacao({...formRelacao, origem_uuid: e.target.value})}><option value="">Selecione...</option>{listaPessoas.map(p => <option key={p.uuid} value={p.uuid}>{p.nome}</option>)}</select></div>
            <div className="form-group">
              <label>Relação</label>
              <select value={formRelacao.tipo} onChange={e => setFormRelacao({...formRelacao, tipo: e.target.value})}>
                <option value="PAI">É Pai de</option>
                <option value="MAE">É Mãe de</option>
                <option value="CASADO">É Casado com</option>
                <option value="IRMAO">É Irmã(o) de</option>
                <option value="FOI">Esteve no Evento</option>
              </select>
            </div>
            <div className="form-group"><label>Destino</label><select required onChange={e => setFormRelacao({...formRelacao, destino_uuid: e.target.value})}><option value="">Selecione...</option>{formRelacao.tipo === 'FOI' ? listaEventos.map(e => <option key={e.uuid} value={e.uuid}>{e.data} - {e.tipo}</option>) : listaPessoas.map(p => <option key={p.uuid} value={p.uuid}>{p.nome}</option>)}</select></div>
            <button type="submit" className="submit-btn" style={{backgroundColor: '#1877f2'}}>{isAdmin ? "Criar Conexão" : "Solicitar Conexão"}</button>
          </form>
        )}

        {temFamilia && activeTab === 'gerenciar' && (
          <div>
            <h2 className="form-title">Gerenciar Registros ({familiaObj?.nome || 'Família'})</h2>
            <p style={{color: '#666', marginBottom: '20px'}}>
              {isAdmin ? "Como Administrador, as suas alterações são aplicadas imediatamente." : "Você pode solicitar novos cadastros, alterações ou exclusões que serão avaliadas por um Administrador."}
            </p>

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
                          <form onSubmit={(e) => dispararAcaoEdicao(e, 'Pessoa')} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                            
                            <div style={{display: 'flex', gap: '10px'}}>
                              <input type="text" value={editandoPessoa.nomeCompleto} onChange={e => setEditandoPessoa({...editandoPessoa, nomeCompleto: e.target.value})} style={{padding: '6px', flex: 2, backgroundColor: '#ffffff', color: '#333333'}} required placeholder="Nome Completo"/>
                              <input type="text" value={editandoPessoa.apelido || ''} onChange={e => setEditandoPessoa({...editandoPessoa, apelido: e.target.value})} placeholder="Apelido" style={{padding: '6px', flex: 1, backgroundColor: '#ffffff', color: '#333333'}}/>
                            </div>

                            <div style={{display: 'flex', gap: '10px'}}>
                              <select value={editandoPessoa.pai_uuid || ''} onChange={e => setEditandoPessoa({...editandoPessoa, pai_uuid: e.target.value})} style={{flex: 1, padding: '6px', backgroundColor: '#ffffff', color: '#333333'}}>
                                <option value="">Pai (Não Definido)</option>
                                {listaPessoas.filter(x => x.uuid !== p.uuid).map(op => <option key={op.uuid} value={op.uuid}>{op.nome}</option>)}
                              </select>
                              <select value={editandoPessoa.mae_uuid || ''} onChange={e => setEditandoPessoa({...editandoPessoa, mae_uuid: e.target.value})} style={{flex: 1, padding: '6px', backgroundColor: '#ffffff', color: '#333333'}}>
                                <option value="">Mãe (Não Definida)</option>
                                {listaPessoas.filter(x => x.uuid !== p.uuid).map(op => <option key={op.uuid} value={op.uuid}>{op.nome}</option>)}
                              </select>
                              <select value={editandoPessoa.conjuge_uuid || ''} onChange={e => setEditandoPessoa({...editandoPessoa, conjuge_uuid: e.target.value})} style={{flex: 1, padding: '6px', backgroundColor: '#ffffff', color: '#333333'}}>
                                <option value="">Cônjuge (Não Definido)</option>
                                {listaPessoas.filter(x => x.uuid !== p.uuid).map(op => <option key={op.uuid} value={op.uuid}>{op.nome}</option>)}
                              </select>
                            </div>

                            <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
                              <button type="button" onClick={() => setEditandoPessoa(null)} style={{background: '#9e9e9e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '8px 15px'}}>Cancelar</button>
                              <button type="submit" style={{background: '#1877f2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '8px 15px'}}>{isAdmin ? "Salvar Tudo" : "Solicitar Alteração"}</button>
                            </div>
                          </form>
                        </td>
                      ) : (
                        <>
                          <td style={{padding: '12px', fontWeight: 'bold'}}>{p.nome}</td>
                          <td style={{padding: '12px', color: '#666'}}>{p.apelido || '-'}</td>
                          <td style={{padding: '12px', textAlign: 'right', whiteSpace: 'nowrap'}}>
                            <button onClick={() => setEditandoPessoa({uuid: p.uuid, nomeCompleto: p.nome, apelido: p.apelido, pai_uuid: '', mae_uuid: '', conjuge_uuid: ''})} style={{padding: '5px 10px', marginRight: '5px', background: '#ffb300', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>Editar</button>
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
                          <form onSubmit={(e) => dispararAcaoEdicao(e, 'Evento')} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                            
                            <div style={{display: 'flex', gap: '10px'}}>
                              <input type="text" value={editandoEvento.tipo} onChange={ev => setEditandoEvento({...editandoEvento, tipo: ev.target.value})} style={{padding: '6px', flex: 1, backgroundColor: '#ffffff', color: '#333333'}} required placeholder="Tipo do Evento"/>
                              <input type="text" value={editandoEvento.local || ''} onChange={ev => setEditandoEvento({...editandoEvento, local: ev.target.value})} placeholder="Local" style={{padding: '6px', flex: 2, backgroundColor: '#ffffff', color: '#333333'}}/>
                            </div>

                            <div>
                              <textarea value={editandoEvento.descricao || ''} onChange={ev => setEditandoEvento({...editandoEvento, descricao: ev.target.value})} placeholder="Descrição detalhada do evento..." style={{width: '100%', padding: '6px', backgroundColor: '#ffffff', color: '#333333', borderRadius: '4px', border: '1px solid #ccc'}} rows="2"/>
                            </div>

                            <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
                              <button type="button" onClick={() => setEditandoEvento(null)} style={{background: '#9e9e9e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '8px 15px'}}>Cancelar</button>
                              <button type="submit" style={{background: '#1877f2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '8px 15px'}}>{isAdmin ? "Salvar Tudo" : "Solicitar Alteração"}</button>
                            </div>
                          </form>
                        </td>
                      ) : (
                        <>
                          <td style={{padding: '12px', fontWeight: 'bold'}}>{e.tipo}</td>
                          <td style={{padding: '12px', color: '#666'}}>{e.data}</td>
                          <td style={{padding: '12px', whiteSpace: 'nowrap'}}>{e.local || '-'}</td>
                          <td style={{padding: '12px', textAlign: 'right', whiteSpace: 'nowrap'}}>
                            <button onClick={() => setEditandoEvento({uuid: e.uuid, tipo: e.tipo, local: e.local, descricao: e.descricao, participantes: []})} style={{padding: '5px 10px', marginRight: '5px', background: '#ffb300', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>Editar</button>
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

        {/* TAB FAMÍLIAS (Apenas Superusuários) */}
        {isSuperuser && activeTab === 'familias' && (
          <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px'}}>
              <div>
                <h2 className="form-title" style={{margin: 0}}>Espaços Familiares (Workspaces)</h2>
                <p style={{color: '#666', margin: '5px 0 0 0'}}>
                  {!temFamilia ? "🌐 Modo Visão Geral ativo (Nenhuma família selecionada)." : `Família ativa: ${familiaObj?.nome || familiaAtiva}`}
                </p>
              </div>
              <button 
                onClick={() => setCriandoFamiliaDireta(!criandoFamiliaDireta)} 
                style={{padding: '8px 16px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'}}
              >
                {criandoFamiliaDireta ? "Cancelar" : "+ Nova Família"}
              </button>
            </div>

            {criandoFamiliaDireta && (
              <form onSubmit={handleCriarFamiliaAdmin} style={{background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e9ecef'}}>
                <h4 style={{marginTop: 0, color: '#333'}}>Cadastrar Nova Família Diretamente</h4>
                <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'}}>
                  <input 
                    type="text" 
                    placeholder="Nome da Família (Ex: Família Souza)" 
                    value={nomeDiretoFamilia} 
                    onChange={e => setNomeDiretoFamilia(e.target.value)} 
                    required 
                    style={{flex: 2, minWidth: '220px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', color: '#333'}}
                  />
                  <select
                    value={funcaoDiretaFamilia}
                    onChange={e => setFuncaoDiretaFamilia(e.target.value)}
                    style={{flex: 1, minWidth: '160px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', color: '#333'}}
                  >
                    <option value="ADMIN">🛡️ Administrador</option>
                    <option value="COLABORADOR">✏️ Editor</option>
                    <option value="LEITOR">📖 Leitor</option>
                  </select>
                  <button type="submit" style={{padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'}}>
                    Criar e Ativar
                  </button>
                </div>
              </form>
            )}

            {temFamilia && (
              <div style={{marginBottom: '20px'}}>
                <button 
                  onClick={() => { localStorage.removeItem('familiaAtiva'); window.location.reload(); }}
                  style={{padding: '8px 14px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold'}}
                >
                  🌐 Desmarcar Família Ativa (Entrar em Visão Geral)
                </button>
              </div>
            )}

            {(!familias || familias.length === 0) ? (
              <div style={{padding: '30px', textAlign: 'center', background: '#fff', borderRadius: '8px', border: '1px dashed #ccc'}}>
                <p style={{color: '#666', margin: 0, fontWeight: 'bold'}}>Nenhuma família cadastrada no sistema ainda.</p>
                <p style={{color: '#888', fontSize: '0.85rem', marginTop: '6px'}}>
                  Quando novos usuários solicitarem a criação de famílias, os pedidos aparecerão na aba <strong>Aprovações</strong> para revisão.
                </p>
              </div>
            ) : (
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px'}}>
                {familias.map(f => {
                  const isAtiva = f.uuid === familiaAtiva;
                  return (
                    <div key={f.uuid} style={{background: '#fff', padding: '18px', borderRadius: '8px', border: isAtiva ? '2px solid #1877f2' : '1px solid #e0e0e0', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                        <h4 style={{margin: '0 0 5px 0', color: '#333'}}>{f.nome}</h4>
                        {isAtiva && <span style={{fontSize: '0.75rem', background: '#e3f2fd', color: '#1565c0', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold'}}>Ativa</span>}
                      </div>
                      <p style={{margin: '0 0 10px 0', fontSize: '0.8rem', color: '#666'}}>
                        Função atual: <strong>{f.funcao === 'ADMIN' ? 'Administrador' : f.funcao === 'COLABORADOR' ? 'Editor' : 'Leitor'}</strong>
                      </p>
                      <div style={{marginBottom: '10px'}}>
                        <label style={{fontSize: '0.75rem', color: '#555', display: 'block', marginBottom: '3px'}}>
                          Função ao entrar:
                        </label>
                        <select
                          value={funcaoSelecionadaPorFamilia[f.uuid] || f.funcao || 'ADMIN'}
                          onChange={e => setFuncaoSelecionadaPorFamilia({
                            ...funcaoSelecionadaPorFamilia,
                            [f.uuid]: e.target.value
                          })}
                          style={{width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.85rem', backgroundColor: '#fff', color: '#333'}}
                        >
                          <option value="ADMIN">🛡️ Administrador</option>
                          <option value="COLABORADOR">✏️ Editor</option>
                          <option value="LEITOR">📖 Leitor</option>
                        </select>
                      </div>
                      <div style={{display: 'flex', gap: '8px', marginTop: '12px'}}>
                        <button 
                          onClick={() => handleEntrarFamiliaAdmin(f.uuid, f.nome)}
                          style={{
                            flex: 1, padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                            background: isAtiva ? '#4caf50' : '#1877f2', color: 'white', fontWeight: 'bold'
                          }}
                        >
                          {isAtiva ? "✓ Ativa (Atualizar)" : "Entrar"}
                        </button>
                        {user?.is_superuser && (
                          <button 
                            onClick={() => excluirFamilia(f.uuid, f.nome)}
                            title={`Excluir permanentemente a família "${f.nome}"`}
                            style={{
                              padding: '8px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                              background: '#d32f2f', color: 'white', fontWeight: 'bold'
                            }}
                          >
                            🗑️ Excluir
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB MEMBROS (Administradores da família ou Superusuários dentro de uma família selecionada) */}
        {isFamiliaAdmin && temFamilia && activeTab === 'membros' && (
          <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <div>
                <h2 className="form-title" style={{margin: 0}}>Usuários Cadastrados na Família</h2>
                <p style={{color: '#666', margin: '5px 0 0 0'}}>
                  Família ativa: <strong>{familiaObj?.nome || familiaAtiva}</strong> ({listaMembros.length} usuário{listaMembros.length !== 1 ? 's' : ''} registrado{listaMembros.length !== 1 ? 's' : ''})
                </p>
              </div>
              <button 
                onClick={atualizarTabelas} 
                style={{padding: '6px 14px', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem'}}
              >
                🔄 Atualizar
              </button>
            </div>

            {listaMembros.length === 0 ? (
              <div style={{padding: '30px', textAlign: 'center', background: '#fff', borderRadius: '8px', border: '1px dashed #ccc'}}>
                <p style={{color: '#666', margin: 0}}>Nenhum usuário cadastrado como membro desta família ainda.</p>
              </div>
            ) : (
              <div style={{overflowX: 'auto', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem'}}>
                  <thead>
                    <tr style={{background: '#f8f9fa', borderBottom: '2px solid #dee2e6'}}>
                      <th style={{padding: '12px 16px'}}>Usuário</th>
                      <th style={{padding: '12px 16px'}}>E-mail</th>
                      <th style={{padding: '12px 16px'}}>Papel / Função</th>
                      <th style={{padding: '12px 16px'}}>Tipo de Usuário</th>
                      <th style={{padding: '12px 16px'}}>Data de Adesão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaMembros.map(m => (
                      <tr key={m.id} style={{borderBottom: '1px solid #e9ecef'}}>
                        <td style={{padding: '12px 16px', fontWeight: 'bold'}}>
                          👤 {m.username}
                        </td>
                        <td style={{padding: '12px 16px', color: '#555'}}>
                          {m.email || <em style={{color: '#aaa'}}>Não informado</em>}
                        </td>
                        <td style={{padding: '12px 16px'}}>
                          <select
                            value={m.funcao}
                            onChange={(e) => alterarFuncaoMembro(m.id, e.target.value)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #ccc',
                              fontSize: '0.85rem',
                              fontWeight: 'bold',
                              backgroundColor: m.funcao === 'ADMIN' ? '#e3f2fd' : m.funcao === 'COLABORADOR' ? '#fff3e0' : '#f5f5f5',
                              color: m.funcao === 'ADMIN' ? '#1565c0' : m.funcao === 'COLABORADOR' ? '#e65100' : '#424242',
                              cursor: 'pointer'
                            }}
                            title="Alterar função do membro na família"
                          >
                            <option value="LEITOR">📖 Leitor</option>
                            <option value="COLABORADOR">✏️ Editor</option>
                            <option value="ADMIN">🛡️ Administrador</option>
                          </select>
                        </td>
                        <td style={{padding: '12px 16px'}}>
                          {m.is_superuser ? (
                            <span style={{padding: '3px 10px', borderRadius: '12px', fontSize: '0.8rem', background: '#fce4ec', color: '#c2185b', fontWeight: 'bold'}}>
                              Superusuário
                            </span>
                          ) : (
                            <span style={{padding: '3px 10px', borderRadius: '12px', fontSize: '0.8rem', background: '#e8f5e9', color: '#2e7d32', fontWeight: 'bold'}}>
                              Usuário Comum
                            </span>
                          )}
                        </td>
                        <td style={{padding: '12px 16px', color: '#888', fontSize: '0.85rem'}}>
                          {m.aderiu_em || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB APROVAÇÕES (Apenas Superusuários) */}
        {isSuperuser && activeTab === 'aprovacoes' && (
          <div>
            <h2 className="form-title">Pedidos de Moderação</h2>
            {listaSolicitacoes.length === 0 ? <p style={{color: '#666'}}>Não há solicitações pendentes no momento.</p> : (
              <div style={{display: 'grid', gap: '15px'}}>
                {listaSolicitacoes.map(sol => (
                  <div key={sol.id} style={{background: '#fff', borderLeft: sol.tipo_acao === 'Excluir' ? '5px solid #d32f2f' : sol.tipo_acao === 'Criar' ? '5px solid #2e7d32' : '5px solid #1877f2', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <h4 style={{margin: 0, color: '#333'}}>
                        👤 {sol.usuario} deseja <strong>{sol.tipo_acao}</strong> um(a) <strong>{sol.entidade}</strong>
                      </h4>
                      <span style={{fontSize: '0.8rem', color: '#888'}}>{sol.data_solicitacao}</span>
                    </div>

                    <p style={{margin: '6px 0', fontSize: '0.85rem', color: '#777'}}>
                      Espaço / Família: <strong>{sol.familia_nome}</strong>
                    </p>

                    {/* DADOS DE PROPOSTA DE FAMÍLIA */}
                    {sol.entidade === 'Familia' && (
                      <div style={{margin: '10px 0', padding: '12px', background: '#e8f5e9', borderRadius: '6px', border: '1px solid #c8e6c9'}}>
                        <p style={{margin: 0, fontWeight: 'bold', color: '#2e7d32'}}>
                          🏢 Nova Família: <span style={{fontSize: '1.05rem', color: '#1b5e20'}}>{sol.dados_novos?.nome || 'Sem nome'}</span>
                        </p>
                        <p style={{margin: '6px 0 0 0', fontSize: '0.85rem', color: '#333'}}>
                          <strong>Função solicitada pelo usuário:</strong> {sol.dados_novos?.funcao_display || (sol.dados_novos?.funcao === 'COLABORADOR' ? 'Editor' : sol.dados_novos?.funcao === 'LEITOR' ? 'Leitor' : 'Administrador')}
                        </p>
                        <p style={{margin: '6px 0 0 0', fontSize: '0.85rem', color: '#555'}}>
                          Ao aprovar, o workspace da família e seu nó no grafo serão criados, e <strong>{sol.usuario}</strong> será vinculado com a função de <strong>{sol.dados_novos?.funcao_display || (sol.dados_novos?.funcao === 'COLABORADOR' ? 'Editor' : sol.dados_novos?.funcao === 'LEITOR' ? 'Leitor' : 'Administrador')}</strong>.
                        </p>
                      </div>
                    )}

                    {/* 1. SE FOR CRIAÇÃO */}
                    {sol.tipo_acao === 'Criar' && sol.entidade !== 'Familia' && sol.dados_novos && (
                      <div style={{margin: '10px 0', padding: '10px 14px', background: '#f6ffed', borderRadius: '6px', border: '1px solid #b7eb8f', fontSize: '0.85rem', color: '#222'}}>
                        <p style={{margin: '0 0 6px 0', fontWeight: 'bold', color: '#389e0d'}}>
                          ✨ Novo Registro Proposto:
                        </p>
                        {sol.entidade === 'Pessoa' && (
                          <div>
                            <p style={{margin: '2px 0'}}><strong>Nome:</strong> {sol.dados_novos.nomeCompleto} {sol.dados_novos.apelido ? `("${sol.dados_novos.apelido}")` : ''}</p>
                            {sol.dados_novos.dataNascimento && <p style={{margin: '2px 0'}}><strong>Data de Nascimento:</strong> {sol.dados_novos.dataNascimento}</p>}
                            {sol.dados_novos.dataObito && <p style={{margin: '2px 0'}}><strong>Data de Óbito:</strong> {sol.dados_novos.dataObito}</p>}
                            {sol.dados_novos.pai_nome && sol.dados_novos.pai_nome !== 'Nenhum' && <p style={{margin: '2px 0'}}><strong>Pai:</strong> {sol.dados_novos.pai_nome}</p>}
                            {sol.dados_novos.mae_nome && sol.dados_novos.mae_nome !== 'Nenhum' && <p style={{margin: '2px 0'}}><strong>Mãe:</strong> {sol.dados_novos.mae_nome}</p>}
                            {sol.dados_novos.conjuge_nome && sol.dados_novos.conjuge_nome !== 'Nenhum' && <p style={{margin: '2px 0'}}><strong>Cônjuge:</strong> {sol.dados_novos.conjuge_nome}</p>}
                          </div>
                        )}
                        {sol.entidade === 'Evento' && (
                          <div>
                            <p style={{margin: '2px 0'}}><strong>Tipo:</strong> {sol.dados_novos.tipo}</p>
                            <p style={{margin: '2px 0'}}><strong>Data:</strong> {sol.dados_novos.data}</p>
                            {sol.dados_novos.local && <p style={{margin: '2px 0'}}><strong>Local:</strong> {sol.dados_novos.local}</p>}
                            {sol.dados_novos.descricao && <p style={{margin: '2px 0'}}><strong>Descrição:</strong> {sol.dados_novos.descricao}</p>}
                          </div>
                        )}
                        {sol.entidade === 'Relacionamento' && (
                          <p style={{margin: '2px 0'}}>
                            <strong>{sol.dados_novos.origem_nome || 'Origem'}</strong> &rarr; <strong>{sol.dados_novos.tipo}</strong> &rarr; <strong>{sol.dados_novos.destino_nome || 'Destino'}</strong>
                          </p>
                        )}
                      </div>
                    )}

                    {/* 2. SE FOR EDIÇÃO (EXIBIÇÃO DAS ALTERAÇÕES DESEJADAS) */}
                    {sol.tipo_acao === 'Editar' && (
                      <div style={{margin: '10px 0', padding: '12px', background: '#f0f7ff', borderRadius: '6px', border: '1px solid #cce5ff'}}>
                        <p style={{margin: '0 0 8px 0', fontWeight: 'bold', color: '#004085', fontSize: '0.9rem'}}>
                          ✏️ Alterações Desejadas para o registro: <em>{sol.dados_atuais?.nomeCompleto || sol.dados_atuais?.tipo || 'Item'}</em>
                        </p>
                        {sol.entidade === 'Pessoa' && (
                          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', background: '#fff', borderRadius: '4px', overflow: 'hidden'}}>
                            <thead>
                              <tr style={{background: '#e9ecef', color: '#495057'}}>
                                <th style={{padding: '6px 10px', textAlign: 'left', width: '25%'}}>Campo</th>
                                <th style={{padding: '6px 10px', textAlign: 'left', width: '35%'}}>Valor Atual</th>
                                <th style={{padding: '6px 10px', textAlign: 'left', width: '40%'}}>Novo Valor Proposto</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                { campo: 'Nome Completo', atual: sol.dados_atuais?.nomeCompleto, novo: sol.dados_novos?.nomeCompleto },
                                { campo: 'Apelido', atual: sol.dados_atuais?.apelido, novo: sol.dados_novos?.apelido },
                                { campo: 'Pai', atual: sol.dados_atuais?.pai_nome, novo: sol.dados_novos?.pai_nome },
                                { campo: 'Mãe', atual: sol.dados_atuais?.mae_nome, novo: sol.dados_novos?.mae_nome },
                                { campo: 'Cônjuge', atual: sol.dados_atuais?.conjuge_nome, novo: sol.dados_novos?.conjuge_nome },
                              ].map((item, idx) => {
                                const mudou = item.novo !== undefined && item.novo !== null && String(item.atual || '').trim() !== String(item.novo || '').trim();
                                return (
                                  <tr key={idx} style={{borderBottom: '1px solid #f1f1f1', background: mudou ? '#fff9e6' : '#fff'}}>
                                    <td style={{padding: '6px 10px', fontWeight: mudou ? 'bold' : 'normal', color: mudou ? '#856404' : '#666'}}>
                                      {item.campo} {mudou && <span style={{fontSize: '0.75rem', background: '#ffeeba', padding: '1px 5px', borderRadius: '3px'}}>Alterado</span>}
                                    </td>
                                    <td style={{padding: '6px 10px', color: '#666', textDecoration: mudou ? 'line-through' : 'none'}}>
                                      {item.atual || <em style={{color: '#aaa'}}>Não definido</em>}
                                    </td>
                                    <td style={{padding: '6px 10px', fontWeight: mudou ? 'bold' : 'normal', color: mudou ? '#28a745' : '#666'}}>
                                      {item.novo || <em style={{color: '#aaa'}}>Não definido</em>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}

                        {sol.entidade === 'Evento' && (
                          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', background: '#fff', borderRadius: '4px', overflow: 'hidden'}}>
                            <thead>
                              <tr style={{background: '#e9ecef', color: '#495057'}}>
                                <th style={{padding: '6px 10px', textAlign: 'left', width: '25%'}}>Campo</th>
                                <th style={{padding: '6px 10px', textAlign: 'left', width: '35%'}}>Valor Atual</th>
                                <th style={{padding: '6px 10px', textAlign: 'left', width: '40%'}}>Novo Valor Proposto</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                { campo: 'Tipo', atual: sol.dados_atuais?.tipo, novo: sol.dados_novos?.tipo },
                                { campo: 'Data', atual: sol.dados_atuais?.data, novo: sol.dados_novos?.data },
                                { campo: 'Local', atual: sol.dados_atuais?.local, novo: sol.dados_novos?.local },
                                { campo: 'Descrição', atual: sol.dados_atuais?.descricao, novo: sol.dados_novos?.descricao },
                              ].map((item, idx) => {
                                const mudou = item.novo !== undefined && item.novo !== null && String(item.atual || '').trim() !== String(item.novo || '').trim();
                                return (
                                  <tr key={idx} style={{borderBottom: '1px solid #f1f1f1', background: mudou ? '#fff9e6' : '#fff'}}>
                                    <td style={{padding: '6px 10px', fontWeight: mudou ? 'bold' : 'normal', color: mudou ? '#856404' : '#666'}}>
                                      {item.campo} {mudou && <span style={{fontSize: '0.75rem', background: '#ffeeba', padding: '1px 5px', borderRadius: '3px'}}>Alterado</span>}
                                    </td>
                                    <td style={{padding: '6px 10px', color: '#666', textDecoration: mudou ? 'line-through' : 'none'}}>
                                      {item.atual || <em style={{color: '#aaa'}}>Não definido</em>}
                                    </td>
                                    <td style={{padding: '6px 10px', fontWeight: mudou ? 'bold' : 'normal', color: mudou ? '#28a745' : '#666'}}>
                                      {item.novo || <em style={{color: '#aaa'}}>Não definido</em>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {/* 3. SE FOR EXCLUSÃO */}
                    {sol.tipo_acao === 'Excluir' && (
                      <div style={{margin: '10px 0', padding: '10px 14px', background: '#fff5f5', borderRadius: '6px', border: '1px solid #ffcdd2'}}>
                        <p style={{margin: '0 0 6px 0', fontWeight: 'bold', color: '#c62828', fontSize: '0.9rem'}}>
                          ⚠️ Registro Solicitado para Exclusão:
                        </p>
                        {sol.entidade === 'Pessoa' && (
                          <div style={{fontSize: '0.85rem', color: '#333'}}>
                            <p style={{margin: '2px 0'}}>
                              <strong>Nome:</strong> {sol.dados_atuais?.nomeCompleto || 'Desconhecido'} {sol.dados_atuais?.apelido ? `("${sol.dados_atuais.apelido}")` : ''}
                            </p>
                            {sol.dados_atuais?.dataNascimento && (
                              <p style={{margin: '2px 0'}}><strong>Data de Nascimento:</strong> {sol.dados_atuais.dataNascimento}</p>
                            )}
                            {sol.dados_atuais?.dataObito && (
                              <p style={{margin: '2px 0'}}><strong>Data de Óbito:</strong> {sol.dados_atuais.dataObito}</p>
                            )}
                            {(sol.dados_atuais?.pai_nome && sol.dados_atuais.pai_nome !== 'Nenhum') && (
                              <p style={{margin: '2px 0'}}><strong>Pai Atual:</strong> {sol.dados_atuais.pai_nome}</p>
                            )}
                            {(sol.dados_atuais?.mae_nome && sol.dados_atuais.mae_nome !== 'Nenhum') && (
                              <p style={{margin: '2px 0'}}><strong>Mãe Atual:</strong> {sol.dados_atuais.mae_nome}</p>
                            )}
                            {(sol.dados_atuais?.conjuge_nome && sol.dados_atuais.conjuge_nome !== 'Nenhum') && (
                              <p style={{margin: '2px 0'}}><strong>Cônjuge Atual:</strong> {sol.dados_atuais.conjuge_nome}</p>
                            )}
                          </div>
                        )}
                        {sol.entidade === 'Evento' && (
                          <div style={{fontSize: '0.85rem', color: '#333'}}>
                            <p style={{margin: '2px 0'}}><strong>Tipo:</strong> {sol.dados_atuais?.tipo || 'Evento'}</p>
                            <p style={{margin: '2px 0'}}><strong>Data:</strong> {sol.dados_atuais?.data || '-'}</p>
                            <p style={{margin: '2px 0'}}><strong>Local:</strong> {sol.dados_atuais?.local || '-'}</p>
                            <p style={{margin: '2px 0'}}><strong>Descrição:</strong> {sol.dados_atuais?.descricao || '-'}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <p style={{margin: '10px 0', color: '#555'}}><strong>Motivo informado:</strong> "{sol.motivo}"</p>
                    <div style={{display: 'flex', gap: '10px'}}>
                      <button onClick={() => julgarSolicitacao(sol.id, 'APROVAR')} style={{padding: '8px 15px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'}}>
                        {sol.entidade === 'Familia' ? "Aprovar e Criar Família" : "Aprovar e Aplicar"}
                      </button>
                      <button onClick={() => julgarSolicitacao(sol.id, 'NEGAR')} style={{padding: '8px 15px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>
                        Negar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB AUDITORIA (Apenas Superusuários) */}
        {isSuperuser && activeTab === 'logs' && (
          <div>
            <h2 className="form-title">Auditoria (Logs)</h2>
            <div style={{overflowX: 'auto', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>
              <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem'}}>
                <thead>
                  <tr style={{background: '#f8f9fa', borderBottom: '2px solid #dee2e6'}}>
                    <th style={{padding: '12px 15px', whiteSpace: 'nowrap'}}>Data/Hora</th>
                    <th style={{padding: '12px 15px', whiteSpace: 'nowrap'}}>Usuário</th>
                    <th style={{padding: '12px 15px', whiteSpace: 'nowrap'}}>Ação</th>
                    <th style={{padding: '12px 15px', whiteSpace: 'nowrap'}}>Entidade</th>
                    <th style={{padding: '12px 15px', width: '100%'}}>Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {listaLogs.length === 0 ? <tr><td colSpan="5" style={{padding: '20px', textAlign: 'center'}}>Nenhum registro de atividade.</td></tr> : listaLogs.map(log => (
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