import { NavLink, useNavigate } from 'react-router-dom'; // <--- MUDOU AQUI
import './Navbar.css';

function Navbar({ user, setUser }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await fetch('http://127.0.0.1:8000/api/auth/logout/', { 
        credentials: 'include' 
      });
      setUser(null);
      localStorage.removeItem('user');
      navigate('/');
    } catch (error) {
      console.error("Erro ao sair", error);
    }
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