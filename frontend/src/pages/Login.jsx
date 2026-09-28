import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import './Login.css';

function Login({ setUser }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Estados da Etapa 1: Credenciais
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [msgSucesso, setMsgSucesso] = useState('');
  const [verificandoStatus, setVerificandoStatus] = useState(false);
  
  // Estados da Etapa 2: Workspaces (Famílias)
  const [step, setStep] = useState(1); 
  const [currentUser, setCurrentUser] = useState(null);
  const [familias, setFamilias] = useState([]);
  const [todasFamilias, setTodasFamilias] = useState([]);
  const [solicitacaoPendente, setSolicitacaoPendente] = useState(false);
  
  // Estados para entrar em família existente
  const [familiaParaEntrar, setFamiliaParaEntrar] = useState('');
  const [funcaoAoEntrar, setFuncaoAoEntrar] = useState('LEITOR');

  // Estados para criação de nova família
  const [nomeNovaFamilia, setNomeNovaFamilia] = useState('');
  const [motivoNovaFamilia, setMotivoNovaFamilia] = useState('');
  const [funcaoNovaFamilia, setFuncaoNovaFamilia] = useState('ADMIN');
  const [criandoFamilia, setCriandoFamilia] = useState(false);

  // Verifica se o usuário já possui sessão ativa ao carregar a página
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/auth/check/`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.is_logged_in) {
          setUser(data.user);
          setCurrentUser(data.user);
          setFamilias(data.familias || []);
          setTodasFamilias(data.todas_familias || []);
          setSolicitacaoPendente(Boolean(data.solicitacao_familia_pendente));

          if (data.familias && data.familias.length > 0) {
            setFamiliaParaEntrar(data.familias[0].uuid);
            setFuncaoAoEntrar(data.familias[0].funcao || 'LEITOR');
            setCriandoFamilia(false);
          } else {
            setCriandoFamilia(true);
            if (data.todas_familias && data.todas_familias.length > 0) {
              setFamiliaParaEntrar(data.todas_familias[0].uuid);
            }
          }

          if (data.user.is_superuser && (!data.familias || data.familias.length === 0)) {
            localStorage.removeItem('familiaAtiva');
            navigate('/admin');
            return;
          }
          setStep(2);
        }
      })
      .catch(() => {});
  }, [navigate, setUser]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMsgSucesso('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', 
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        setCurrentUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        verificarFamilias(data.user);
      } else {
        setError(data.message || "Erro ao entrar. Verifique as suas credenciais.");
      }
    } catch (err) {
      console.error(err);
      setError("Erro de conexão. O servidor Django está em execução?");
    }
  };

  const verificarFamilias = async (loggedUser, isManualCheck = false) => {
    setError('');
    if (isManualCheck) {
      setVerificandoStatus(true);
      setMsgSucesso('');
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/check/`, {
        credentials: 'include'
      });
      const data = await res.json();
      
      if (data.is_logged_in) {
        const u = loggedUser || currentUser || data.user;
        setUser(data.user);
        setCurrentUser(data.user);
        setFamilias(data.familias || []);
        setTodasFamilias(data.todas_familias || []);
        setSolicitacaoPendente(Boolean(data.solicitacao_familia_pendente));

        if (data.familias && data.familias.length > 0) {
          if (!familiaParaEntrar) {
            setFamiliaParaEntrar(data.familias[0].uuid);
            setFuncaoAoEntrar(data.familias[0].funcao || 'LEITOR');
          }
          setCriandoFamilia(false);
        } else {
          setCriandoFamilia(true);
          if (data.todas_familias && data.todas_familias.length > 0 && !familiaParaEntrar) {
            setFamiliaParaEntrar(data.todas_familias[0].uuid);
          }
        }

        if (isManualCheck) {
          if (data.solicitacao_familia_pendente) {
            setMsgSucesso("⏳ Sua solicitação de criação de família continua em análise pelos administradores. Por favor, aguarde.");
          } else if (data.familias && data.familias.length > 0) {
            setMsgSucesso("🎉 Sua família foi aprovada e está disponível abaixo!");
          } else if (data.ultima_solicitacao?.status === 'NEGADA') {
            setError("❌ Sua solicitação de criação de família foi negada pelos administradores.");
          } else {
            setMsgSucesso("ℹ️ Nenhuma solicitação pendente encontrada.");
          }
        }

        // Se for superusuário e não houver famílias ainda, pode ir direto para moderação
        if (u?.is_superuser && (!data.familias || data.familias.length === 0)) {
          localStorage.removeItem('familiaAtiva');
          navigate('/admin');
          return;
        }

        setStep(2); // Avança para a tela de seleção
      }
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar os seus espaços de trabalho.");
    } finally {
      if (isManualCheck) {
        setVerificandoStatus(false);
      }
    }
  };

  const handleEntrarFamilia = async (e) => {
    e.preventDefault();
    if (!familiaParaEntrar) {
      setError("Selecione uma família para entrar.");
      return;
    }
    setError('');
    setMsgSucesso('');

    const jaEhMembro = familias && familias.some(f => f.uuid === familiaParaEntrar);

    if (jaEhMembro) {
      localStorage.setItem('familiaAtiva', familiaParaEntrar);
      navigate('/arvore');
      window.location.reload();
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/familias/entrar/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          familia_uuid: familiaParaEntrar,
          funcao: 'LEITOR'
        })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('familiaAtiva', data.uuid);
        navigate('/arvore');
        window.location.reload();
      } else {
        setError(data.message || "Erro ao entrar na família.");
      }
    } catch (err) {
      console.error(err);
      setError("Erro de conexão ao entrar na família.");
    }
  };

  const selecionarFamiliaDireto = (uuid) => {
    if (!uuid) {
      localStorage.removeItem('familiaAtiva');
    } else {
      localStorage.setItem('familiaAtiva', uuid);
    }
    navigate('/admin');
    window.location.reload();
  };

  const handleCriarFamilia = async (e) => {
    e.preventDefault();
    setError('');
    setMsgSucesso('');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/familias/criar/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          nome: nomeNovaFamilia, 
          motivo: motivoNovaFamilia,
          funcao: funcaoNovaFamilia 
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        if (data.pendente) {
          setMsgSucesso("✅ Solicitação de criação de família enviada com sucesso! Um administrador revisará o pedido.");
          setSolicitacaoPendente(true);
          setCriandoFamilia(false);
          setNomeNovaFamilia('');
          setMotivoNovaFamilia('');
        } else {
          localStorage.setItem('familiaAtiva', data.uuid);
          navigate('/admin');
          window.location.reload();
        }
      } else {
        setError(data.message || "Erro ao criar família.");
      }
    } catch (err) {
      setError("Erro de conexão ao tentar criar a família.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        {step === 1 ? (
          <>
            <h2>🔐 Entrar no iGen</h2>
            <p>Faça login para gerenciar a árvore.</p>
            
            {error && <p className="error-msg">{error}</p>}

            <form onSubmit={handleLogin}>
              <input 
                type="text" 
                placeholder="Usuário" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <input 
                type="password" 
                placeholder="Senha" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="submit">Entrar</button>
            </form>

            <div className="register-link">
                <p>Ainda não tem conta?</p>
                <Link to="/register">Crie uma agora</Link>
            </div>
          </>
        ) : (
          <>
            <h2>👨‍👩‍👧 Família</h2>
            {familias && familias.length > 0 ? (
              <p>Escolha sua família ou crie uma nova.</p>
            ) : (
              <p>Você ainda não pertence a nenhuma família. Solicite a criação de uma família</p>
            )}

            {error && <p className="error-msg">{error}</p>}
            {msgSucesso && <p className="success-msg" style={{padding: '10px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '6px', fontSize: '0.9rem', marginBottom: '15px'}}>{msgSucesso}</p>}

            {/* Opção para Superusuário entrar na visão geral */}
            {currentUser?.is_superuser && !criandoFamilia && (
              <div style={{ marginBottom: '15px' }}>
                <button
                  type="button"
                  onClick={() => selecionarFamiliaDireto('')}
                  style={{ backgroundColor: '#ff9800', color: '#fff', border: 'none', fontWeight: 'bold' }}
                >
                  🌐 Entrar na Visão Geral (Moderação)
                </button>
              </div>
            )}

            {/* Aviso de solicitação pendente para usuário comum com botão de verificação */}
            {solicitacaoPendente && !currentUser?.is_superuser && (
              <div style={{ padding: '15px', background: '#fff3e0', border: '1px solid #ffe082', borderRadius: '8px', marginBottom: '20px', textAlign: 'left' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#e65100' }}>⏳ Solicitação em Análise</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
                  Você possui uma solicitação de criação de família aguardando a aprovação de um administrador.
                </p>
                <button 
                  type="button" 
                  onClick={() => verificarFamilias(null, true)} 
                  disabled={verificandoStatus}
                  style={{ marginTop: '10px', padding: '8px 14px', fontSize: '0.85rem', background: '#e65100', color: 'white', border: 'none', borderRadius: '4px', cursor: verificandoStatus ? 'wait' : 'pointer', fontWeight: 'bold' }}
                >
                  {verificandoStatus ? "🔄 Verificando..." : "🔄 Verificar Status de Aprovação"}
                </button>
              </div>
            )}

            {/* 1. SEÇÃO DE ENTRAR EM UMA FAMÍLIA EXISTENTE (Exibida apenas quando NÃO estiver criando família) */}
            {!criandoFamilia && (
              <div style={{ background: '#f8f9fa', padding: '18px', borderRadius: '8px', border: '1px solid #e9ecef', marginBottom: '20px', textAlign: 'left' }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#333' }}>Entrar em uma Família</h4>
                
                {((familias && familias.length > 0) || (todasFamilias && todasFamilias.length > 0)) ? (
                  <form onSubmit={handleEntrarFamilia}>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#555', marginBottom: '5px' }}>
                        Selecione a Família:
                      </label>
                      <select 
                        value={familiaParaEntrar} 
                        onChange={(e) => setFamiliaParaEntrar(e.target.value)}
                        required
                        style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', color: '#333' }}
                      >
                        <option value="">Selecione uma família...</option>
                        {familias && familias.length > 0 && (
                          <optgroup label="Minhas Famílias">
                            {familias.map(f => (
                              <option key={`minha-${f.uuid}`} value={f.uuid}>
                                {f.nome} ({f.funcao === 'ADMIN' ? 'Administrador' : f.funcao === 'COLABORADOR' ? 'Editor' : 'Leitor'})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {todasFamilias && todasFamilias.filter(tf => !familias?.some(mf => mf.uuid === tf.uuid)).length > 0 && (
                          <optgroup label={familias && familias.length > 0 ? "Outras Famílias Disponíveis" : "Famílias Disponíveis"}>
                            {todasFamilias.filter(tf => !familias?.some(mf => mf.uuid === tf.uuid)).map(f => (
                              <option key={`outra-${f.uuid}`} value={f.uuid}>
                                {f.nome}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    {(() => {
                      const famSel = (familias && familias.length > 0 ? familias : todasFamilias).find(x => x.uuid === familiaParaEntrar);
                      if (!famSel?.funcao) return null;
                      const funcaoTexto = famSel.funcao === 'ADMIN' ? '🛡️ Administrador' : famSel.funcao === 'COLABORADOR' ? '✏️ Editor' : '📖 Leitor';
                      return (
                        <div style={{ marginBottom: '15px', padding: '8px 12px', background: '#eef2f6', borderRadius: '6px', fontSize: '0.85rem', color: '#444' }}>
                          Sua função nesta família: <strong>{funcaoTexto}</strong>
                        </div>
                      );
                    })()}

                    <button 
                      type="submit" 
                      disabled={!familiaParaEntrar}
                      style={{ 
                        width: '100%', padding: '10px', background: familiaParaEntrar ? '#1877f2' : '#ccc', 
                        color: 'white', border: 'none', borderRadius: '6px', cursor: familiaParaEntrar ? 'pointer' : 'not-allowed',
                        fontWeight: 'bold' 
                      }}
                    >
                      Entrar na Família
                    </button>
                  </form>
                ) : (
                  <p style={{ color: '#666', fontSize: '0.9rem', margin: '0 0 15px 0' }}>
                    Nenhuma família disponível para entrar no momento.
                  </p>
                )}

                <div style={{ marginTop: '15px', borderTop: '1px solid #e0e0e0', paddingTop: '12px', textAlign: 'center' }}>
                  <button 
                    type="button" 
                    onClick={() => setCriandoFamilia(true)} 
                    style={{ backgroundColor: '#28a745', width: '100%', fontWeight: 'bold', padding: '10px', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    {currentUser?.is_superuser ? "+ Nova Família" : "+ Solicitar Nova Família"}
                  </button>
                </div>
              </div>
            )}

            {/* 2. SEÇÃO DE CRIAR/SOLICITAR FAMÍLIA (Exibida apenas quando criandoFamilia for TRUE) */}
            {criandoFamilia && (
              <form onSubmit={handleCriarFamilia} style={{ background: '#f8f9fa', padding: '18px', borderRadius: '8px', border: '1px solid #e9ecef', marginBottom: '20px', textAlign: 'left' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>
                  {currentUser?.is_superuser ? "Criar Nova Família Diretamente" : "Solicitar Criação de Família"}
                </h4>
                <p style={{ fontSize: '0.85rem', marginBottom: '12px', color: '#666' }}>
                  {currentUser?.is_superuser 
                    ? "Como administrador, crie uma família diretamente e defina a sua função:" 
                    : "Informe o nome da família, a função desejada e o motivo da solicitação:"}
                </p>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#555', marginBottom: '4px' }}>
                    Nome da Família *
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ex: Família Silva Santos" 
                    value={nomeNovaFamilia}
                    onChange={(e) => setNomeNovaFamilia(e.target.value)}
                    required
                    style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', color: '#333' }}
                  />
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#555', marginBottom: '4px' }}>
                    Função que deseja exercer:
                  </label>
                  <select 
                    value={funcaoNovaFamilia} 
                    onChange={(e) => setFuncaoNovaFamilia(e.target.value)}
                    style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', color: '#333' }}
                  >
                    <option value="ADMIN">🛡️ Administrador (Acesso total)</option>
                    <option value="COLABORADOR">✏️ Editor (Cadastra e edita registros)</option>
                    <option value="LEITOR">📖 Leitor (Apenas visualização)</option>
                  </select>
                </div>

                {!currentUser?.is_superuser && (
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#555', marginBottom: '4px' }}>
                      Motivo da Solicitação (Opcional):
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: Quero organizar a genealogia da minha família" 
                      value={motivoNovaFamilia}
                      onChange={(e) => setMotivoNovaFamilia(e.target.value)}
                      style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', color: '#333' }}
                    />
                  </div>
                )}

                <button type="submit" style={{ width: '100%', backgroundColor: '#28a745', color: 'white', fontWeight: 'bold', padding: '10px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  {currentUser?.is_superuser ? "Criar Família" : "Enviar Pedido de Criação"}
                </button>
                
                {((familias && familias.length > 0) || (todasFamilias && todasFamilias.length > 0)) && (
                  <button 
                    type="button" 
                    onClick={() => setCriandoFamilia(false)} 
                    style={{ background: 'none', color: '#1877f2', width: '100%', textAlign: 'center', marginTop: '12px', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem' }}
                  >
                    Entrar em uma família existente
                  </button>
                )}
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Login;