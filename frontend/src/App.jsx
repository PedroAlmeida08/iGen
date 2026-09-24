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
import './App.css';

function App() {
  const [user, setUser] = useState(null); 
  const [familias, setFamilias] = useState([]); 

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/auth/check/', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.is_logged_in) {
          setUser(data.user);
          setFamilias(data.familias); 

          const familiaAtiva = localStorage.getItem('familiaAtiva');
          const pertenceAFamilia = data.familias.some(f => f.uuid === familiaAtiva);
          
          if (!pertenceAFamilia && data.familias.length > 0) {
             localStorage.setItem('familiaAtiva', data.familias[0].uuid);
          }
        }
      })
      .catch(err => console.log("Não autenticado"));
  }, []);

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
            <Route 
              path="/arvore" 
              element={user ? <Arvore /> : <Navigate to="/login" replace />} 
            />
            <Route 
              path="/timeline" 
              element={user ? <Timeline /> : <Navigate to="/login" replace />} 
            />
            <Route 
              path="/admin" 
              element={user ? <Admin user={user} /> : <Navigate to="/login" replace />} 
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;