import React, { useState } from 'react';
import { login, register } from '../lib/api';

interface Props {
  basePath: string;
}

export default function LoginForm({ basePath }: Props) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password, email || undefined);
      }
      // Redirect to app
      window.location.href = `${basePath.endsWith('/') ? basePath : basePath + '/'}app`;
    } catch (err) {
      setError('Der opstod en fejl. Kontroller venligst dine oplysninger og prøv igen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Lyd til Tekst
          </h1>
          <p className="text-gray-600">
            Upload en lydfil og få tekst tilbage
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          {/* Tabs */}
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => { if (!loading) { setIsLogin(true); setError(''); } }}
              disabled={loading}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                isLogin
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              } ${loading ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              Log ind
            </button>
            <button
              type="button"
              onClick={() => { if (!loading) { setIsLogin(false); setError(''); } }}
              disabled={loading}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                !isLogin
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              } ${loading ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              Opret konto
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Brugernavn
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="Dit brugernavn"
                required
                minLength={3}
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Adgangskode
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Din adgangskode"
                required
                minLength={6}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
            </div>

            {!isLogin && (
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-gray-400">(valgfri)</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="din@email.dk"
                  autoComplete="email"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Bruges kun til at nulstille din adgangskode
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  <span>Vent venligst...</span>
                </>
              ) : isLogin ? (
                'Log ind'
              ) : (
                'Opret konto'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
