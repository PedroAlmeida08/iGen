import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Arvore from './pages/Arvore';
import Timeline from './pages/Timeline';
import Login from './pages/Login';
import Register from './pages/Register';
import Admin from './pages/Admin';
import Sobre from './pages/Sobre';
import { API_BASE_URL } from './config';
import './App.css';

function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }); 
  const [familias, setFamilias] = useState([]); 
  const [carregandoAuth, setCarregandoAuth] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/auth/check/`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.is_logged_in) {
          const familiaAtiva = localStorage.getItem('familiaAtiva');
          const pertenceAFamilia = data.familias ? data.familias.some(f => f.uuid === familiaAtiva) : false;
          
          let famUuid = familiaAtiva;
          if (data.user.is_superuser) {
            if (familiaAtiva && !pertenceAFamilia) {
              localStorage.removeItem('familiaAtiva');
              famUuid = '';
            }
          } else {
            if (!pertenceAFamilia && data.familias && data.familias.length > 0) {
              famUuid = data.familias[0].uuid;
              localStorage.setItem('familiaAtiva', famUuid);
            } else if (!data.familias || data.familias.length === 0) {
              localStorage.removeItem('familiaAtiva');
              famUuid = '';
            }
          }

          const famObj = data.familias ? data.familias.find(f => f.uuid === famUuid) : null;
          const isAdmin = Boolean(data.user.is_superuser || (famObj && famObj.funcao === 'ADMIN'));

          const userAtualizado = { ...data.user, is_admin: isAdmin };
          setUser(userAtualizado);
          localStorage.setItem('user', JSON.stringify(userAtualizado));
          setFamilias(data.familias || []); 
        } else {
          setUser(null);
          localStorage.removeItem('user');
        }
      })
      .catch(err => {
        console.log("Não autenticado", err);
        setUser(null);
        localStorage.removeItem('user');
      })
      .finally(() => {
        setCarregandoAuth(false);
      });
  }, []);

  if (carregandoAuth) {
    return (
      <div style={{
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        fontSize: '1.2rem', 
        color: '#555'
      }}>
        🧬 Carregando iGen...
      </div>
    );
  }

  return (
    <Router>
      <div className="app-main">
        <Navbar user={user} setUser={setUser} familias={familias} />
        
        <div className="content-wrap">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/sobre" element={<Sobre />} />
            
            <Route path="/login" element={<Login setUser={setUser} />} />
            <Route path="/register" element={<Register />} />
            
            {/* --- ROTAS PROTEGIDAS (Exigem Autenticação) --- */}
            <Route path="/arvore" element={<Arvore user={user} />} />
            <Route path="/timeline" element={<Timeline user={user} />} />
            <Route 
              path="/admin" 
              element={user ? <Admin user={user} familias={familias} /> : <Navigate to="/login" replace />} 
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;