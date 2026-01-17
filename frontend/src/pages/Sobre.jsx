import React from 'react';
import './Sobre.css';

function Sobre() {
  return (
    <div className="sobre-container">
      
      {/* 1. HERO SECTION */}
      <header className="sobre-header">
        <h1>🧬 Sobre o iGen</h1>
        <p>
          O <strong>iGen</strong> é uma plataforma moderna para preservação da memória familiar. 
          Utilizando a tecnologia de Grafos, transformamos histórias e conexões genealógicas complexas 
          em visualizações interativas e acessíveis.
        </p>
      </header>

      {/* 2. TECNOLOGIAS */}
      <section className="tech-section">
        <h2 className="section-title">Stack Tecnológico</h2>
        <div className="tech-grid">
          
          <div className="tech-card">
            <span className="tech-icon">🐍</span>
            <h3>Django & Python</h3>
            <p>Backend robusto gerenciando regras de negócio, segurança e API.</p>
          </div>

          <div className="tech-card">
            <span className="tech-icon">🕸️</span>
            <h3>Neo4j Graph DB</h3>
            <p>Banco de dados NoSQL nativo em grafos para modelagem de relacionamentos complexos.</p>
          </div>

          <div className="tech-card">
            <span className="tech-icon">⚛️</span>
            <h3>React.js</h3>
            <p>Frontend reativo baseado em componentes para uma experiência de usuário fluida.</p>
          </div>

          <div className="tech-card">
            <span className="tech-icon">📊</span>
            <h3>Data Viz</h3>
            <p>Renderização dinâmica de nós e arestas com algoritmos de força (Vis.js).</p>
          </div>

        </div>
      </section>

      {/* 3. CONTEXTO ACADÊMICO (TEXTO ATUALIZADO) */}
      <section className="author-section">
        <div className="author-avatar">
          {/* Suas iniciais */}
          JP
        </div>
        <div className="author-info">
          <h2>Desenvolvido por</h2>
          <h3>João Pedro Santos</h3>
          
          <p>
            Este projeto foi desenvolvido como parte do Trabalho de Conclusão de Curso (TCC) 
            do <strong>Bacharelado em Ciência da Computação</strong> da <strong>Universidade Federal Fluminense (UFF)</strong>.
          </p>
          
          <p style={{marginTop: '15px'}}>
            A construção do <em>iGen</em> consolidou na prática competências multidisciplinares fundamentais, abrangendo:
          </p>
          
          <ul style={{marginTop: '10px', marginLeft: '20px', color: '#555', lineHeight: '1.6'}}>
            <li><strong>Engenharia de Software:</strong> Arquitetura MVC/MVT e padrões de projeto.</li>
            <li><strong>Engenharia de Dados:</strong> Modelagem não-relacional e estruturação de grafos.</li>
            <li><strong>Desenvolvimento Fullstack:</strong> Integração de API RESTful com interfaces reativas.</li>
            <li><strong>Banco de Dados em Grafos:</strong> Consultas utilizando Cypher Query Language.</li>
            <li><strong>Visualização de Dados:</strong> Algoritmos de renderização de redes.</li>
            <li><strong>Segurança:</strong> Implementação de autenticação e controle de acesso.</li>
          </ul>

          <p style={{marginTop: '20px', fontSize: '0.9rem', color: '#777'}}>
            📧 jp_almeida@id.uff.com | 📍 Niterói, Brasil
          </p>
        </div>
      </section>

      {/* 4. DEDICATÓRIA */}
      <section className="thanks-section">
        <h3>Agradecimentos</h3>
        <p>
          "Dedico este trabalho a Deus, à minha família pelo apoio incondicional 
          e ao meu orientador que guiou neste caminho técnico e acadêmico."
        </p>
      </section>

    </div>
  );
}

export default Sobre;