import React, { useState, useEffect } from 'react';
import { 
  Users, 
  FileText, 
  Activity, 
  UserPlus, 
  ToggleLeft, 
  ToggleRight, 
  ShieldAlert, 
  ShieldCheck, 
  RefreshCw,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'user';
  ativo: boolean;
  created_at: string;
}

interface PainelAdminProps {
  onLogout: () => void;
  onClose: () => void;
  session?: any;
}

export default function PainelAdmin({ onLogout, onClose, session }: PainelAdminProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const getHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/usuarios', { 
        credentials: 'include',
        headers: getHeaders()
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao buscar usuários');
      }
      setUsers(data);
    } catch (error: any) {
      if (error.message.includes("Unexpected token")) {
        showMessage("Erro de conexão ao buscar usuários", 'error');
      } else {
        showMessage(error.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !invitePassword) return;
    
    setInviteLoading(true);
    try {
      const response = await fetch('/api/admin/criar-usuario', {
        method: 'POST',
        credentials: 'include',
        headers: getHeaders(),
        body: JSON.stringify({ email: inviteEmail, password: invitePassword }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao criar usuário');
      
      showMessage('Usuário criado com sucesso!', 'success');
      setInviteEmail('');
      setInvitePassword('');
      fetchUsers();
    } catch (error: any) {
      showMessage(error.message, 'error');
    } finally {
      setInviteLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/usuario/${id}/ativo`, {
        method: 'PATCH',
        credentials: 'include',
        headers: getHeaders(),
        body: JSON.stringify({ ativo: !currentStatus }),
      });
      if (!response.ok) throw new Error('Erro ao atualizar status');
      fetchUsers();
    } catch (error: any) {
      showMessage(error.message, 'error');
    }
  };

  const changeRole = async (id: string, newRole: string) => {
    try {
      const response = await fetch(`/api/admin/usuario/${id}/role`, {
        method: 'PATCH',
        credentials: 'include',
        headers: getHeaders(),
        body: JSON.stringify({ role: newRole }),
      });
      if (!response.ok) throw new Error('Erro ao atualizar role');
      fetchUsers();
    } catch (error: any) {
      showMessage(error.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-6 md:p-12 font-sans text-neutral-900">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-2">
              <ShieldCheck className="w-8 h-8 text-blue-600" />
              Painel Administrativo
            </h1>
            <p className="text-neutral-500 mt-1">Gerencie acessos e usuários do Coruja Pedagógica SaaS.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg shadow-sm hover:bg-neutral-200 transition-colors font-medium text-sm"
            >
              Voltar ao Gerador
            </button>
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-rose-200 text-rose-600 rounded-lg shadow-sm hover:bg-rose-50 transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm flex items-center gap-4">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-neutral-500 font-medium">Total de Usuários</p>
              <p className="text-2xl font-bold text-neutral-900">{users.length}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm flex items-center gap-4">
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-lg">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-neutral-500 font-medium">Usuários Ativos</p>
              <p className="text-2xl font-bold text-neutral-900">{users.filter(u => u.ativo).length}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm flex items-center gap-4">
            <div className="p-4 bg-purple-50 text-purple-600 rounded-lg">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-neutral-500 font-medium">Planos Gerados</p>
              <p className="text-2xl font-bold text-neutral-900">--</p>
              <p className="text-xs text-neutral-400">Em breve</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <AnimatePresence>
          {message.text && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-4 rounded-lg flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
            >
              <ShieldAlert className="w-5 h-5" />
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Invite Form */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-neutral-500" />
                Convidar Usuário
              </h2>
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">E-mail</label>
                  <input 
                    type="email" 
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="email@exemplo.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Senha Temporária</label>
                  <input 
                    type="password" 
                    value={invitePassword}
                    onChange={(e) => setInvitePassword(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={inviteLoading}
                  className="w-full bg-neutral-900 text-white font-medium py-2 px-4 rounded-lg hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {inviteLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Cadastrar e Convidar
                </button>
              </form>
            </div>
          </div>

          {/* Users Table */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col h-full">
              <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Tabela de Usuários</h2>
                <button onClick={fetchUsers} className="text-neutral-500 hover:text-neutral-700">
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 text-neutral-500 text-sm">
                      <th className="px-6 py-3 font-medium border-b border-neutral-200">E-mail</th>
                      <th className="px-6 py-3 font-medium border-b border-neutral-200">Nível de Acesso</th>
                      <th className="px-6 py-3 font-medium border-b border-neutral-200">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && users.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-neutral-500">Carregando usuários...</td>
                      </tr>
                    ) : users.map(user => (
                      <tr key={user.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50">
                        <td className="px-6 py-4">
                          <span className="font-medium text-neutral-800">{user.email}</span>
                          <span className="block text-xs text-neutral-400 mt-1">
                            Adicionado {new Date(user.created_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <select 
                            value={user.role}
                            onChange={(e) => changeRole(user.id, e.target.value)}
                            className={`text-sm px-2 py-1 rounded-md border font-medium ${
                              user.role === 'admin' 
                                ? 'bg-purple-50 text-purple-700 border-purple-200' 
                                : 'bg-neutral-100 text-neutral-700 border-neutral-200'
                            }`}
                          >
                            <option value="user">Usuário</option>
                            <option value="admin">Administrador</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => toggleStatus(user.id, user.ativo)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                              user.ativo 
                                ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                                : 'bg-red-50 text-red-600 hover:bg-red-100'
                            }`}
                          >
                            {user.ativo ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                            {user.ativo ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
