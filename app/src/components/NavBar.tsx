

const NavBar = () => {
  return (
    <nav className="nav-bar">
      <div className="nav-content">
        <div className="nav-left">
          <h1 className="nav-title">PDF Resume Analyzer</h1>
        </div>
        <div className="nav-right">
          <a href="/" className="nav-link">Home</a>
          <a href="/about" className="nav-link">About</a>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;