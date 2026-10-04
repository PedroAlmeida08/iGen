import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Tutorial.css';

function Tutorial() {
  const [etapaAtiva, setEtapaAtiva] = useState(1);
  const [mostrarTudo, setMostrarTudo] = useState(false);

  const etapas = [
    { id: 1, label: 'Passo 1', title: 'Conta e Família' },
    { id: 2, label: 'Passo 2', title: 'Solicitações e Gestão' },
    { id: 3, label: 'Passo 3', title: 'Moderação e Aprovação' },
    { id: 4, label: 'Passo 4', title: 'Árvore e Linha do Tempo' },
  ];

  const exibirEtapa = (num) => mostrarTudo || etapaAtiva === num;

  return (
    <div className="tutorial-container">
      {/* CABEÇALHO */}
      <header className="tutorial-header">
        <h1>📚 Tutorial da Plataforma iGen</h1>
        <p>
          Aprenda passo a passo como utilizar o <strong>iGen</strong> para preservar e explorar a história da sua família — 
          desde a criação da sua conta e envio de solicitações até a visualização das aprovações na Árvore Genealógica e na Linha do Tempo.
        </p>
      </header>

      {/* ALTERNADOR DE MODO DE VISUALIZAÇÃO */}
      <div className="view-mode-toggle">
        <button
          type="button"
          className="btn-toggle-mode"
          onClick={() => setMostrarTudo(!mostrarTudo)}
        >
          {mostrarTudo ? '📑 Visualizar por Etapas' : '📜 Expandir Todo o Tutorial'}
        </button>
      </div>

      {/* BARRA DE ETAPAS (STEPPER) */}
      {!mostrarTudo && (
        <div className="tutorial-stepper">
          {etapas.map((etapa) => (
            <button
              key={etapa.id}
              type="button"
              className={`step-tab-btn ${etapaAtiva === etapa.id ? 'active' : ''}`}
              onClick={() => setEtapaAtiva(etapa.id)}
            >
              <span className="step-number">{etapa.id}</span>
              <div className="step-tab-info">
                <span className="step-tab-label">{etapa.label}</span>
                <span className="step-tab-title">{etapa.title}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* =====================================================================
          ETAPA 1: CRIAÇÃO DE CONTA, LOGIN E ESPAÇOS FAMILIARES
         ===================================================================== */}
      {exibirEtapa(1) && (
        <section className="tutorial-section-card">
          <div className="tutorial-section-header">
            <span className="tutorial-section-badge">Passo 1</span>
            <h2>Criação de Conta e Acesso à Família</h2>
          </div>

          <p className="tutorial-intro-text">
            No <strong>iGen</strong>, os dados genealógicos são privados e organizados em <strong>Espaços Familiares (Workspaces)</strong>. 
            Para começar a explorar ou colaborar com a árvore da sua família, o primeiro passo é criar uma conta e vincular-se a um espaço familiar.
          </p>

          <div className="tutorial-substeps">
            <div className="substep-card">
              <span className="substep-icon">📝</span>
              <h3>1.1. Criar uma Conta</h3>
              <p>
                Clique em <strong>Entrar</strong> no menu superior e selecione <em>"Crie uma agora"</em>. 
                Informe um <strong>Nome de Usuário</strong>, o seu <strong>E-mail</strong> (opcional) e uma <strong>Senha</strong>, 
                clicando em <strong>Registrar</strong>.
              </p>
            </div>

            <div className="substep-card">
              <span className="substep-icon">🔐</span>
              <h3>1.2. Fazer Login</h3>
              <p>
                Com a conta criada, insira seu usuário e senha na tela de <strong>Login</strong>. 
                Após a autenticação, você será direcionado automaticamente para a etapa de seleção de <strong>Família</strong>.
              </p>
            </div>

            <div className="substep-card">
              <span className="substep-icon">👨‍👩‍👧</span>
              <h3>1.3. Entrar ou Solicitar Família</h3>
              <p>
                Você pode <strong>selecionar uma família existente</strong> na lista para ingressar imediatamente ou clicar em 
                <strong> "+ Solicitar Nova Família"</strong>, informando o nome da família, a função desejada e o motivo do pedido.
              </p>
            </div>
          </div>

          <h3 style={{ color: '#333', marginBottom: '10px' }}>Papéis e Permissões dentro de uma Família:</h3>
          <div className="roles-grid">
            <div className="role-box leitor">
              <h4>📖 Leitor</h4>
              <p>
                Acesso de visualização à <strong>Árvore Genealógica</strong> e à <strong>Linha do Tempo</strong>, 
                podendo utilizar todos os filtros de busca e publicar <strong>comentários e memórias</strong> nos perfis dos familiares.
              </p>
            </div>

            <div className="role-box editor">
              <h4>✏️ Editor (Colaborador)</h4>
              <p>
                Além de visualizar e comentar, tem acesso à aba <strong>Gestão</strong> para <strong>solicitar a inclusão, edição ou exclusão</strong> de 
                pessoas, eventos históricos e laços de parentesco.
              </p>
            </div>

            <div className="role-box admin">
              <h4>🛡️ Administrador</h4>
              <p>
                Realiza cadastros e alterações com aplicação imediata, gerencia as funções dos membros da família, 
                consulta os registros de auditoria e <strong>aprova ou nega as solicitações</strong> enviadas pelos Editores.
              </p>
            </div>
          </div>

          <div className="tutorial-footer-nav">
            <Link to="/register" className="btn-tutorial-primary">
              Ir para Criação de Conta &rarr;
            </Link>
            {!mostrarTudo && (
              <button type="button" className="btn-tutorial-nav" onClick={() => setEtapaAtiva(2)}>
                Próximo: Solicitações e Gestão &rarr;
              </button>
            )}
          </div>
        </section>
      )}

      {/* =====================================================================
          ETAPA 2: SOLICITAÇÃO DE INCLUSÃO, EDIÇÃO OU EXCLUSÃO
         ===================================================================== */}
      {exibirEtapa(2) && (
        <section className="tutorial-section-card">
          <div className="tutorial-section-header">
            <span className="tutorial-section-badge">Passo 2</span>
            <h2>Solicitação de Inclusão, Edição ou Exclusão</h2>
          </div>

          <p className="tutorial-intro-text">
            Usuários com perfil de <strong>Editor (Colaborador)</strong> ou <strong>Administrador</strong> têm acesso ao painel 
            <strong> Gestão</strong> na barra superior. É por meio desse painel que novos familiares, eventos e conexões são adicionados ou corrigidos.
          </p>

          <div className="tutorial-substeps">
            <div className="substep-card">
              <span className="substep-icon">👤</span>
              <h3>2.1. Incluir uma Pessoa</h3>
              <p>
                Na aba <strong>Nova Pessoa</strong>, preencha o Nome Completo, a Data de Nascimento, a Data de Óbito (opcional) e o Apelido. 
                Clique em <em>"Solicitar Cadastro de Pessoa"</em> (ou <em>"Salvar Pessoa"</em> se for Administrador).
              </p>
            </div>

            <div className="substep-card">
              <span className="substep-icon">📅</span>
              <h3>2.2. Incluir um Evento</h3>
              <p>
                Na aba <strong>Novo Evento</strong>, registre acontecimentos marcantes da família (como Casamentos, Formaturas, Viagens ou Mudanças), 
                informando o <strong>Tipo/Título</strong>, a <strong>Data</strong> e o <strong>Local</strong>.
              </p>
            </div>

            <div className="substep-card">
              <span className="substep-icon">🔗</span>
              <h3>2.3. Criar Laços Familiares</h3>
              <p>
                Na aba <strong>Criar Laços</strong>, conecte dois membros da família escolhendo a relação 
                (<em>É Pai de</em>, <em>É Mãe de</em>, <em>É Casado com</em>, <em>É Irmã(o) de</em>) ou vincule uma pessoa a um evento (<em>Esteve no Evento</em>).
              </p>
            </div>

            <div className="substep-card">
              <span className="substep-icon">📋</span>
              <h3>2.4. Pedir Edição ou Exclusão</h3>
              <p>
                Encontrou um dado incorreto? Na aba <strong>Gerenciar Dados</strong>, localize a pessoa ou o evento na tabela e clique em 
                <strong> Editar</strong> (para corrigir nomes, pais, cônjuge ou descrições) ou em <strong>Excluir</strong>.
              </p>
            </div>
          </div>

          <div className="tutorial-callout">
            <h4>💡 Automação Inteligente e Justificativa do Pedido</h4>
            <p>
              <strong>1. Geração Automática de Eventos:</strong> Sempre que uma pessoa é cadastrada com data de nascimento ou data de óbito, 
              o iGen cria e conecta automaticamente os respectivos eventos de <em>Nascimento</em> e <em>Óbito</em> na Linha do Tempo!<br />
              <strong>2. Justificativa de Solicitação:</strong> Quando um Editor envia um pedido de inclusão, edição ou exclusão, o sistema exibe uma 
              janela solicitando o <strong>motivo da alteração</strong> (por exemplo: <em>"Adicionando meu avô materno conforme certidão de nascimento"</em>). 
              Isso ajuda o Administrador a validar a informação com segurança.
            </p>
          </div>

          <div className="tutorial-footer-nav">
            {!mostrarTudo && (
              <button type="button" className="btn-tutorial-nav" onClick={() => setEtapaAtiva(1)}>
                &larr; Anterior: Conta e Família
              </button>
            )}
            <Link to="/admin" className="btn-tutorial-primary">
              Acessar Painel de Gestão &rarr;
            </Link>
            {!mostrarTudo && (
              <button type="button" className="btn-tutorial-nav" onClick={() => setEtapaAtiva(3)}>
                Próximo: Moderação e Aprovação &rarr;
              </button>
            )}
          </div>
        </section>
      )}

      {/* =====================================================================
          ETAPA 3: MODERAÇÃO E APROVAÇÃO PELO ADMINISTRADOR
         ===================================================================== */}
      {exibirEtapa(3) && (
        <section className="tutorial-section-card">
          <div className="tutorial-section-header">
            <span className="tutorial-section-badge">Passo 3</span>
            <h2>Como Funciona a Revisão e Aprovação de Pedidos</h2>
          </div>

          <p className="tutorial-intro-text">
            Para proteger a árvore genealógica contra erros acidentais ou informações conflitantes, todas as solicitações feitas por 
            usuários Colaboradores passam pela revisão de um <strong>Administrador</strong> na aba <strong>🔔 Aprovações</strong>.
          </p>

          <div className="workflow-banner">
            <div className="workflow-node">1. Usuário envia solicitação com motivo</div>
            <span className="workflow-arrow">&rarr;</span>
            <div className="workflow-node">2. Pedido entra na fila de Aprovações</div>
            <span className="workflow-arrow">&rarr;</span>
            <div className="workflow-node">3. Admin analisa comparativo (Antes/Depois)</div>
            <span className="workflow-arrow">&rarr;</span>
            <div className="workflow-node">4. Aprovação atualiza o Grafo automaticamente</div>
          </div>

          <div className="tutorial-substeps">
            <div className="substep-card">
              <span className="substep-icon">🔍</span>
              <h3>3.1. Análise Comparativa</h3>
              <p>
                Na aba <strong>Aprovações</strong>, o Administrador visualiza quem fez o pedido, a data, o motivo informado e uma 
                <strong> tabela comparativa</strong> destacando exatamente quais campos mudaram entre o <em>Valor Atual</em> e o <em>Novo Valor Proposto</em>.
              </p>
            </div>

            <div className="substep-card">
              <span className="substep-icon">✅</span>
              <h3>3.2. Aprovar ou Negar</h3>
              <p>
                Ao clicar em <strong>Aprovar e Aplicar</strong>, o sistema executa imediatamente a criação, edição ou exclusão no banco de dados em grafos. 
                Caso a informação esteja incorreta, basta clicar em <strong>Negar</strong> para descartar o pedido sem afetar a árvore.
              </p>
            </div>

            <div className="substep-card">
              <span className="substep-icon">📜</span>
              <h3>3.3. Registro em Auditoria</h3>
              <p>
                Toda solicitação enviada e toda decisão tomada pela administração ficam registradas cronologicamente na aba 
                <strong> Auditoria (Logs)</strong>, garantindo total transparência sobre a evolução dos dados da família.
              </p>
            </div>
          </div>

          <div className="tutorial-footer-nav">
            {!mostrarTudo && (
              <button type="button" className="btn-tutorial-nav" onClick={() => setEtapaAtiva(2)}>
                &larr; Anterior: Solicitações e Gestão
              </button>
            )}
            {!mostrarTudo && (
              <button type="button" className="btn-tutorial-nav" onClick={() => setEtapaAtiva(4)}>
                Próximo: Visualização das Aprovações &rarr;
              </button>
            )}
          </div>
        </section>
      )}

      {/* =====================================================================
          ETAPA 4: VISUALIZAÇÃO DAS SOLICITAÇÕES APROVADAS
         ===================================================================== */}
      {exibirEtapa(4) && (
        <section className="tutorial-section-card">
          <div className="tutorial-section-header">
            <span className="tutorial-section-badge">Passo 4</span>
            <h2>Visualizando os Dados Aprovados na Plataforma</h2>
          </div>

          <p className="tutorial-intro-text">
            Assim que uma solicitação de inclusão ou edição é <strong>aprovada</strong> pelo Administrador, os novos registros e vínculos 
            ficam imediatamente disponíveis para consulta interativa em três áreas da plataforma:
          </p>

          <div className="tutorial-substeps">
            <div className="substep-card">
              <span className="substep-icon">🏠</span>
              <h3>4.1. Painel Inicial (Início)</h3>
              <p>
                Na página <strong>Início</strong>, os contadores gerais de <em>Familiares Cadastrados</em> e <em>Eventos Históricos</em> 
                são atualizados automaticamente, e os últimos eventos aprovados passam a aparecer na vitrine de <strong>Últimos Registros</strong>.
              </p>
            </div>

            <div className="substep-card">
              <span className="substep-icon">🌳</span>
              <h3>4.2. Árvore Genealógica Interativa</h3>
              <p>
                Na página <strong>Árvore</strong>, a pessoa aprovada aparece como um nó conectado aos seus familiares. 
                Use a caixa <strong>"🔍 Filtrar por nome ou apelido..."</strong> para isolar rapidamente qualquer pessoa e suas conexões diretas.
              </p>
            </div>

            <div className="substep-card">
              <span className="substep-icon">💬</span>
              <h3>4.3. Detalhes e Comentários</h3>
              <p>
                Ao clicar sobre qualquer pessoa na <strong>Árvore</strong> ou qualquer evento na <strong>Linha do Tempo</strong>, 
                abre-se um painel lateral com seus detalhes e a seção de <strong>Comentários</strong>, onde qualquer membro pode registrar histórias e memórias.
              </p>
            </div>

            <div className="substep-card">
              <span className="substep-icon">⏳</span>
              <h3>4.4. Linha do Tempo e Filtros</h3>
              <p>
                Na página <strong>Linha do Tempo</strong>, todos os eventos aprovados são listados em ordem cronológica. 
                Você pode filtrar os acontecimentos por <strong>Nome do Evento</strong>, por <strong>Participantes</strong> (seleção múltipla) 
                e por <strong>Intervalo de Datas</strong> (<em>A partir de</em> / <em>Até</em>).
              </p>
            </div>
          </div>

          <div className="tutorial-callout">
            <h4>🎯 Dica de Exploração</h4>
            <p>
              Clique sobre qualquer cartão de evento na <strong>Linha do Tempo</strong> para abrir os detalhes completos do acontecimento, 
              visualizar a descrição histórica, o local, a lista de participantes e adicionar <strong>comentários sobre o evento</strong>!
            </p>
          </div>

          <div className="tutorial-footer-nav">
            {!mostrarTudo && (
              <button type="button" className="btn-tutorial-nav" onClick={() => setEtapaAtiva(3)}>
                &larr; Anterior: Moderação e Aprovação
              </button>
            )}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Link to="/arvore" className="btn-tutorial-primary">
                Explorar Árvore Genealógica &rarr;
              </Link>
              <Link to="/timeline" className="btn-tutorial-primary" style={{ backgroundColor: '#28a745' }}>
                Explorar Linha do Tempo &rarr;
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default Tutorial;
