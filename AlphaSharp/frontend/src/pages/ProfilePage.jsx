import { useAuth } from '../context/AuthContext';
import { ShieldCheck, LogOut } from 'lucide-react';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  return <div className="workspace-page profile-page"><div className="workspace-intro"><div><p className="section-kicker">Workspace settings</p><h1>Local profile</h1><p>Your profile is saved in this browser.</p></div></div><div className="panel profile-panel"><div className="profile-avatar">{user?.name?.slice(0,1)?.toUpperCase() || 'A'}</div><div><h2>{user?.name || 'Researcher'}</h2><p>{user?.email}</p></div></div><div className="panel profile-note"><ShieldCheck size={23} /><div><h2>Private to this browser</h2><p>AlphaSharp stores your profile, watchlist and portfolio locally. There is no database account. Signing out removes all local data, including the saved email and password verifier.</p><button type="button" className="outline-button" onClick={logout}><LogOut size={16} /> Clear data and sign out</button></div></div></div>;
}

