import React from 'react';
import './Home.css';

function Home() {
  return (
    <div className="page-container">
      <header className="hero">
        <h1>Bem-vindo ao iGen</h1>
        <p className="subtitle">Interactive Genealogy - Preservando Memórias</p>
      </header>

      <section className="content-section">
        <h2>Resumo</h2>
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
      </section>

      <section className="content-section">
        <h2>Introdução e Justificativa</h2>
        <p>
          A inspiração para o projeto iGen surge de uma necessidade familiar concreta. Atualmente, 
          um valioso trabalho de pesquisa e documentação da história da minha família está sendo realizado 
          de forma manual, utilizando cadernos e documentos em papel. Este método apresenta limitações: 
          vulnerabilidade a perdas, dificuldade de compartilhamento e centralização do conhecimento.
        </p>
        <p>
          <strong>A proposta do iGen é uma resposta direta a esse desafio.</strong> O objetivo é migrar este acervo 
          para uma plataforma online, segura e acessível.
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
      </section>
    </div>
  );
}

export default Home;