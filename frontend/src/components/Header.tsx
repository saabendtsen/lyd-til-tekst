import { logout } from '../lib/api';

interface Props {
  username: string;
  basePath: string;
  currentPage: 'app' | 'history';
}

export default function Header({ username, basePath, currentPage }: Props) {
  const handleLogout = async () => {
    await logout();
    window.location.href = basePath;
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo/Title */}
          <a href={`${basePath}app`} className="font-bold text-xl text-gray-900">
            Lyd til Tekst
          </a>

          {/* Navigation */}
          <nav className="flex items-center gap-4">
            <a
              href={`${basePath}app`}
              className={`text-sm ${
                currentPage === 'app'
                  ? 'text-blue-600 font-medium'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Ny
            </a>
            <a
              href={`${basePath}history`}
              className={`text-sm ${
                currentPage === 'history'
                  ? 'text-blue-600 font-medium'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Historik
            </a>
            <div className="w-px h-4 bg-gray-300" />
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Log ud ({username})
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
