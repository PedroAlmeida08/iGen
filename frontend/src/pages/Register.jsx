import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css'; // Reutilizamos o mesmo CSS para manter o padrão

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('http://127.0.0.1:8000/api/auth/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      if (response.ok) {
        alert("Conta criada com sucesso! Agora faça login.");
        navigate('/login');
      } else {
        const data = await response.json(); // Tenta pegar a mensagem de erro do Django
        setError(data.message || "Erro ao criar conta.");
      }
    } catch (err) {
      setError("Erro de conexão.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>📝 Criar Conta</h2>
        <p>Junte-se ao projeto da família.</p>
        
        {error && <p className="error-msg">{error}</p>}

        <form onSubmit={handleRegister}>
          <input 
            type="text" 
            placeholder="Nome de Usuário" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input 
            type="email" 
            placeholder="E-mail (Opcional)" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input 
            type="password" 
            placeholder="Senha" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" style={{backgroundColor: '#28a745'}}>Registrar</button>
        </form>

        <div className="register-link">
            <Link to="/login">Voltar para Login</Link>
        </div>
      </div>
    </div>
  );
}

export default Register;