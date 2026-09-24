import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

function Login({ setUser }) {
  // Estados da Etapa 1: Credenciais
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // Estados da Etapa 2: Workspaces (Famílias)
  const [step, setStep] = useState(1); 
  const [familias, setFamilias] = useState([]);
  const [nomeNovaFamilia, setNomeNovaFamilia] = useState('');
  const [criandoFamilia, setCriandoFamilia] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', 
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Em vez de navegar para o admin, verificamos as famílias a que pertence
        verificarFamilias();
      } else {
        setError(data.message || "Erro ao entrar. Verifique as suas credenciais.");
      }
    } catch (err) {
      console.error(err);
      setError("Erro de conexão. O servidor Django está a correr?");
    }
  };

  const verificarFamilias = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/auth/check/', {
        credentials: 'include'
      });
      const data = await res.json();
      
      if (data.is_logged_in) {
        setFamilias(data.familias || []);
        setStep(2); // Avança para a tela de seleção
      }
    } catch (err) {
      setError("Erro ao carregar os seus espaços de trabalho.");
    }
  };

  const selecionarFamilia = (uuid) => {
    // Guarda o identificador do workspace para ser usado em todas as rotas do frontend
    localStorage.setItem('familiaAtiva', uuid);
    navigate('/admin');
  };

  const handleCriarFamilia = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await fetch('http://localhost:8000/api/familias/criar/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nome: nomeNovaFamilia })
      });

      const data = await response.json();
      
      if (response.ok) {
        // Ao criar, o backend já lhe dá a permissão de ADMIN, logo podemos entrar diretamente
        selecionarFamilia(data.uuid);
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
            <h2>👨‍👩‍👧 Selecionar Família</h2>
            <p>Escolha o seu espaço de trabalho ou crie um novo.</p>

            {error && <p className="error-msg">{error}</p>}

            {/* Lista as famílias existentes */}
            {familias.length > 0 && !criandoFamilia && (
              <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {familias.map(f => (
                  <button 
                    key={f.uuid} 
                    type="button"
                    onClick={() => selecionarFamilia(f.uuid)}
                    style={{ backgroundColor: '#f0f0f0', color: '#333', border: '1px solid #ccc' }}
                  >
                    Entrar em: <strong>{f.nome}</strong> <span style={{fontSize: '0.8rem'}}>({f.funcao})</span>
                  </button>
                ))}
              </div>
            )}

            {/* Formulário para criar nova família */}
            {criandoFamilia || familias.length === 0 ? (
              <form onSubmit={handleCriarFamilia} style={{ borderTop: familias.length > 0 ? '1px solid #eee' : 'none', paddingTop: '15px' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '10px', color: '#555' }}>
                  {familias.length === 0 ? "Você ainda não pertence a nenhuma família. Crie uma para começar:" : "Dê um nome à nova família:"}
                </p>
                <input 
                  type="text" 
                  placeholder="Ex: Família Silva" 
                  value={nomeNovaFamilia}
                  onChange={(e) => setNomeNovaFamilia(e.target.value)}
                  required
                />
                <button type="submit" style={{ backgroundColor: '#28a745' }}>Criar e Entrar</button>
                
                {familias.length > 0 && (
                  <button 
                    type="button" 
                    onClick={() => setCriandoFamilia(false)} 
                    style={{ background: 'none', color: '#666', padding: 0, marginTop: '10px', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    Voltar à lista
                  </button>
                )}
              </form>
            ) : (
              <button onClick={() => setCriandoFamilia(true)} style={{ backgroundColor: '#1877f2', marginTop: '10px' }}>
                + Nova Família
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Login;