import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

function Login({ setUser }) { // Recebe a função para atualizar o App.jsx
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Fundamental para salvar o Cookie de sessão
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        // 1. Atualiza o estado global no App.jsx (faz a Navbar mudar)
        setUser(data.user);
        
        // 2. Salva localmente (opcional, para persistência rápida visual)
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // 3. Redireciona para a área admin
        navigate('/admin');
      } else {
        setError(data.message || "Erro ao entrar. Verifique suas credenciais.");
      }
    } catch (err) {
      console.error(err);
      setError("Erro de conexão com o servidor. O Django está rodando?");
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
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
      </div>
    </div>
  );
}

export default Login;