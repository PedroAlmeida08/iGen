import { NavLink, useNavigate } from 'react-router-dom'; // <--- MANTÉM-SE AQUI
import './Navbar.css';

function Navbar({ user, setUser, familias }) { // NOVO: Recebe 'familias' do App.jsx
  const navigate = useNavigate();
  
  // Obtém a família atualmente ativa para marcar no menu suspenso
  const familiaAtiva = localStorage.getItem('familiaAtiva');

  const handleLogout = async () => {
    try {
      await fetch('http://127.0.0.1:8000/api/auth/logout/', { 
        credentials: 'include' 
      });
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('familiaAtiva'); // NOVO: Limpa a família ao terminar sessão
      navigate('/');
    } catch (error) {
      console.error("Erro ao sair", error);
    }
  };

  const handleTrocarFamilia = (e) => {
    const novoUuid = e.target.value;
    localStorage.setItem('familiaAtiva', novoUuid);
    window.location.reload(); // Recarrega a página para atualizar os dados com o novo filtro
  };

  return (
    <nav className="navbar">
      <div className="navbar-logo">🧬 iGen</div>
      <ul className="navbar-links">
        {/* Adicione 'end' apenas no Início para ele não ficar ativo em outras páginas */}
        <li><NavLink to="/" end>Início</NavLink></li>
        <li><NavLink to="/arvore">Árvore</NavLink></li>
        <li><NavLink to="/timeline">Linha do Tempo</NavLink></li>
        
        {user ? (
          <>
            <li><NavLink to="/admin">Admin</NavLink></li>
            
            {/* NOVO: Seletor de Famílias na Navbar */}
            {familias && familias.length > 0 && (
              <li className="navbar-familia-selector" style={{ margin: '0 10px' }}>
                <select 
                  value={familiaAtiva || ''} 
                  onChange={handleTrocarFamilia}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    backgroundColor: '#f8f9fa',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    color: '#333'
                  }}
                  title="Mudar de Família"
                >
                  {familias.map(f => (
                    <option key={f.uuid} value={f.uuid}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </li>
            )}

            <li>
              <button onClick={handleLogout} className="logout-btn">
                Sair ({user.username})
              </button>
            </li>
          </>
        ) : (
          <li><NavLink to="/login">Gestão</NavLink></li>
        )}

        <li><NavLink to="/sobre">Sobre</NavLink></li>
      </ul>
    </nav>
  );
}

export default Navbar;