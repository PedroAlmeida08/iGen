import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Arvore from './pages/Arvore';
import Timeline from './pages/Timeline';
import Login from './pages/Login';
import Register from './pages/Register';
import Admin from './pages/Admin';
import Sobre from './pages/Sobre';
import './App.css';

function App() {
  const [user, setUser] = useState(null); // Aqui guardamos quem está logado

  // Verifica sessão ao carregar a página (F5)
  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/auth/check/', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.is_logged_in) {
          setUser(data.user);
        }
      })
      .catch(err => console.log("Não logado"));
  }, []);

  return (
    <Router>
      <div className="app-main">
        {/* Passamos o user e a função setUser para a Navbar */}
        <Navbar user={user} setUser={setUser} />
        
        <div className="content-wrap">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/arvore" element={<Arvore />} />
            <Route path="/timeline" element={<Timeline />} />
            
            {/* Passamos setUser para o Login, para ele atualizar a Navbar ao entrar */}
            <Route path="/login" element={<Login setUser={setUser} />} />
            <Route path="/register" element={<Register />} />
            
            <Route path="/admin" element={user ? <Admin /> : <div style={{padding:'50px', textAlign:'center', color:'red'}}><h2>Acesso Negado</h2></div>} />

            <Route path="/sobre" element={<Sobre />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;