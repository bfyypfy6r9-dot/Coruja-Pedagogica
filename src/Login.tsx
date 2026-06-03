import React, { useState } from 'react';
import { Lock, Mail, RefreshCw, AlertCircle, Sparkles, X } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Inicializando instãncia client do Supabase conectada às variáveis de ambiente
// @ts-ignore
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
// @ts-ignore
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface LoginProps {
  onLogin: (session: any, user: any) => void;
  onCancel?: () => void;
}

export default function Login({ onLogin, onCancel }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Usando a autenticação nativa do Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Propaga a sessão e os dados do usuário para o App.tsx
      onLogin(data.session, data.user);
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-neutral-900/40 backdrop-blur-md flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      {onCancel && (
        <button 
          onClick={onCancel}
          className="absolute top-6 right-6 p-2 text-neutral-400 hover:text-neutral-700 bg-white rounded-full shadow-md border border-neutral-200 transition-all transform hover:scale-105"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      )}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md animate-in fade-in zoom-in duration-300">
        <div className="bg-white py-8 px-4 shadow-xl border border-neutral-100 sm:rounded-2xl sm:px-10">
          <div className="flex justify-center text-blue-600 mb-4">
            <Sparkles className="w-10 h-10" />
          </div>
          <h2 className="text-center text-2xl font-extrabold text-neutral-900 mb-2">
            Entrar no Sistema
          </h2>
          <p className="text-center text-sm text-neutral-500 mb-8">
            Faça login com e-mail e senha para acessar o gerador
          </p>

          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                <p className="ml-3 text-sm font-medium text-red-700">{error}</p>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-neutral-700">
                E-mail
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-neutral-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-blue-600 focus:border-blue-600 block w-full pl-10 sm:text-sm border-neutral-200 rounded-lg py-3 border outline-none transition-colors bg-neutral-50 focus:bg-white"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700">
                Senha
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-neutral-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-blue-600 focus:border-blue-600 block w-full pl-10 sm:text-sm border-neutral-200 rounded-lg py-3 border outline-none transition-colors bg-neutral-50 focus:bg-white"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all transform hover:-translate-y-0.5"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Entrar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
