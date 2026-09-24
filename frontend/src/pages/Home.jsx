import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

function Home() {
  const [stats, setStats] = useState({ pessoas: 0, eventos: 0 });
  const [ultimosEventos, setUltimosEventos] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false); 
  const [activeInfo, setActiveInfo] = useState('resumo');

  // Resgata a família atual da memória do navegador
  const familiaAtiva = localStorage.getItem('familiaAtiva');
  const temFamilia = familiaAtiva && familiaAtiva !== 'undefined' && familiaAtiva !== 'null';

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'X-Familia-UUID': temFamilia ? familiaAtiva : ''
  });

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/auth/check/', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.is_logged_in) {
          setIsLoggedIn(true);
        }
      })
      .catch(() => console.log("Usuário não tem sessão iniciada"));

    // SÓ ACESSA O BANCO SE HOUVER UMA FAMÍLIA VÁLIDA
    if (temFamilia) {
      fetch('http://localhost:8000/api/pessoas/', { headers: getHeaders(), credentials: 'include' })
        .then(res => res.ok ? res.json() : [])
        .then(data => {
            if (Array.isArray(data)) setStats(prev => ({ ...prev, pessoas: data.length }));
        })
        .catch(err => console.error("Erro ao carregar pessoas:", err));
        
      fetch('http://localhost:8000/api/eventos/', { headers: getHeaders(), credentials: 'include' })
        .then(res => res.ok ? res.json() : [])
        .then(data => {
            if (Array.isArray(data)) {
                setStats(prev => ({ ...prev, eventos: data.length }));
                setUltimosEventos(data.slice(-3).reverse());
            }
        })
        .catch(err => console.error("Erro ao carregar eventos:", err));
    }
  }, [familiaAtiva]);

  return (
    <div className="home-container">
      
      <header className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">Bem-vindo ao iGen</h1>
          <p className="hero-subtitle">Interactive Genealogy - Preservando Memórias</p>
          <div className="hero-actions">
            <Link to="/arvore" className="btn-action">Árvore Genealógica</Link>
            <Link to="/timeline" className="btn-action">Timeline</Link>
            <Link to={isLoggedIn ? "/admin" : "/login"} className="btn-action">
              Acessar Painel Administrativo
            </Link>
          </div>
        </div>
      </header>

      {/* --- DASHBOARD DINÂMICO (SÓ MOSTRA SE TIVER FAMÍLIA) --- */}
      {temFamilia ? (
        <>
          <section className="stats-section">
            <div className="stat-card">
              <h3>{stats.pessoas}</h3>
              <p>Familiares Cadastrados</p>
            </div>
            <div className="stat-card">
              <h3>{stats.eventos}</h3>
              <p>Eventos Históricos</p>
            </div>
          </section>

          <section className="recent-events-section">
            <h2 className="section-title">Últimos Registros</h2>
            <div className="events-grid">
              {ultimosEventos.length === 0 ? (
                <p className="empty-msg">Nenhum evento registrado ainda nesta família.</p>
              ) : (
                ultimosEventos.map((evento) => (
                  <div key={evento.uuid} className="event-card">
                    <div className="event-icon">📅</div>
                    <h4 className="event-title">{evento.tipo}</h4>
                    <p className="event-date">{evento.data}</p>
                    <p className="event-local">{evento.local || 'Local não informado'}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      ) : (
        <section style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#f9fafb', margin: '20px auto', maxWidth: '800px', borderRadius: '12px' }}>
          <h3 style={{ color: '#555' }}>
            {isLoggedIn ? "Selecione ou crie um espaço de trabalho familiar no menu para ver os dados." : "Faça login para acessar os registros da sua família."}
          </h3>
        </section>
      )}

      {/* --- SEÇÃO SOBRE O PROJETO --- */}
      <section className="about-section">
        <div className="about-tabs">
          <button 
            className={`about-tab-btn ${activeInfo === 'resumo' ? 'active' : ''}`}
            onClick={() => setActiveInfo('resumo')}
          >
            📖 Resumo do Projeto
          </button>
          <button 
            className={`about-tab-btn ${activeInfo === 'justificativa' ? 'active' : ''}`}
            onClick={() => setActiveInfo('justificativa')}
          >
            🎯 Introdução e Justificativa
          </button>
        </div>

        <div className="about-content">
          {activeInfo === 'resumo' && (
            <div className="about-pane fade-in">
              <p>
                Este projeto propõe o desenvolvimento de uma aplicação web destinada à gestão colaborativa e 
                visualização interativa de dados genealógicos. Inspirado por um esforço familiar de pesquisa manual, 
                o sistema visa digitalizar e expandir esse conhecimento, permitindo o cadastro de indivíduos e eventos 
                em um banco de dados de grafo.
              </p>
              <p>
                O objetivo central é criar uma ferramenta que não apenas organize e preserve o histórico familiar, 
                mas que também sirva como um ponto de encontro digital, onde múltiplos membros da família possam 
                visualizar e acrescentar informações.
              </p>
            </div>
          )}

          {activeInfo === 'justificativa' && (
            <div className="about-pane fade-in">
              <p>
                A inspiração para o projeto iGen surge de uma necessidade familiar concreta. Atualmente, 
                um valioso trabalho de pesquisa e documentação da história da família está sendo realizado 
                de forma manual. Este método apresenta limitações: vulnerabilidade a perdas, dificuldade de compartilhamento e centralização do conhecimento.
              </p>
              
              <div className="features-list">
                  <h3>Objetivos Práticos:</h3>
                  <ul>
                      <li>Visualizar de forma clara e interativa a árvore genealógica.</li>
                      <li>Contribuir ativamente com novas informações de forma colaborativa.</li>
                  </ul>
              </div>

              <p className="academic-note">
                <em>
                  Academicamente, o projeto explora como bancos de dados de grafo (Neo4j) e frameworks reativos (React) 
                  podem resolver a modelagem de redes de parentesco.
                </em>
              </p>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}

export default Home;