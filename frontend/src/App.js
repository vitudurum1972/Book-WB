import React, { useState, useEffect, createContext, useContext } from 'react';
import { api } from './api';
import './App.css';

// --- Auth Context ---
const AuthContext = createContext(null);

function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  const login = async (email, password) => {
    const data = await api.login(email, password);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- Simple Router ---
function useHash() {
  const [hash, setHash] = useState(window.location.hash || '#/');
  useEffect(() => {
    const handler = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return hash;
}

// --- Login Page ---
function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Geräte-Reservierung</h1>
        <p className="login-subtitle">Melden Sie sich an</p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>E-Mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Passwort</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Anmeldung...' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- Navigation ---
function Nav() {
  const { user, logout, isAdmin } = useAuth();
  const hash = useHash();

  return (
    <nav className="nav">
      <div className="nav-brand">Geräte-Reservierung</div>
      <div className="nav-links">
        <a href="#/" className={hash === '#/' ? 'active' : ''}>Geräte</a>
        <a href="#/reservierungen" className={hash === '#/reservierungen' ? 'active' : ''}>Meine Reservierungen</a>
        {isAdmin && <a href="#/admin/users" className={hash.startsWith('#/admin') ? 'active' : ''}>Verwaltung</a>}
      </div>
      <div className="nav-user">
        <span>{user?.name}</span>
        <button onClick={logout} className="btn btn-small">Abmelden</button>
      </div>
    </nav>
  );
}

// --- Items Page ---
function ItemsPage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getItems(), api.getCategories()])
      .then(([items, cats]) => { setItems(items); setCategories(cats); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter ? items.filter(i => i.category === filter) : items;

  if (loading) return <div className="loading">Laden...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Verfügbare Geräte</h2>
        <div className="filters">
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">Alle Kategorien</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="items-grid">
        {filtered.map(item => (
          <a key={item.id} href={`#/item/${item.id}`} className="item-card">
            <div className="item-icon">{item.category === 'Elektronik' ? '💻' : item.category === 'Werkzeug' ? '🔧' : item.category === 'Messgerät' ? '📊' : '📦'}</div>
            <h3>{item.name}</h3>
            <p className="item-category">{item.category || 'Unkategorisiert'}</p>
            {item.location && <p className="item-location">📍 {item.location}</p>}
            <span className={`badge ${item.available ? 'badge-green' : 'badge-red'}`}>
              {item.available ? 'Verfügbar' : 'Nicht verfügbar'}
            </span>
          </a>
        ))}
        {filtered.length === 0 && <p className="empty">Keine Geräte gefunden.</p>}
      </div>
    </div>
  );
}

// --- Item Detail / Reserve ---
function ItemDetailPage({ id }) {
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.getItem(id).then(setItem).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleReserve = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await api.createReservation({
        item_id: parseInt(id),
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        notes,
      });
      setSuccess('Reservierung erstellt!');
      setStartDate(''); setEndDate(''); setNotes('');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="loading">Laden...</div>;
  if (!item) return <div className="page"><p>Gerät nicht gefunden.</p></div>;

  return (
    <div className="page">
      <a href="#/" className="back-link">← Zurück zur Übersicht</a>
      <div className="detail-header">
        <h2>{item.name}</h2>
        <span className={`badge ${item.available ? 'badge-green' : 'badge-red'}`}>
          {item.available ? 'Verfügbar' : 'Nicht verfügbar'}
        </span>
      </div>
      {item.description && <p className="detail-desc">{item.description}</p>}
      <div className="detail-meta">
        {item.category && <span>Kategorie: {item.category}</span>}
        {item.location && <span>Standort: {item.location}</span>}
      </div>

      <div className="two-col">
        <div className="col">
          <h3>Reservieren</h3>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
          {item.available ? (
            <form onSubmit={handleReserve}>
              <div className="form-group">
                <label>Von</label>
                <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Bis</label>
                <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Notizen (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows="2" />
              </div>
              <button type="submit" className="btn btn-primary">Reservieren</button>
            </form>
          ) : (
            <p>Dieses Gerät ist derzeit nicht verfügbar.</p>
          )}
        </div>

        <div className="col">
          <h3>Aktuelle Reservierungen</h3>
          {item.reservations && item.reservations.length > 0 ? (
            <div className="reservations-list">
              {item.reservations.map(r => (
                <div key={r.id} className="reservation-item">
                  <div className="reservation-dates">
                    {new Date(r.start_date).toLocaleString('de-DE')} — {new Date(r.end_date).toLocaleString('de-DE')}
                  </div>
                  <div className="reservation-user">{r.user_name}</div>
                  {r.notes && <div className="reservation-notes">{r.notes}</div>}
                </div>
              ))}
            </div>
          ) : (
            <p className="empty">Keine aktuellen Reservierungen.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- My Reservations ---
function MyReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.getMyReservations().then(setReservations).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCancel = async (id) => {
    if (!window.confirm('Reservierung wirklich stornieren?')) return;
    try {
      await api.cancelReservation(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="loading">Laden...</div>;

  const active = reservations.filter(r => r.status === 'active');
  const past = reservations.filter(r => r.status !== 'active');

  return (
    <div className="page">
      <h2>Meine Reservierungen</h2>

      <h3>Aktiv</h3>
      {active.length > 0 ? (
        <table className="table">
          <thead>
            <tr><th>Gerät</th><th>Von</th><th>Bis</th><th>Notizen</th><th></th></tr>
          </thead>
          <tbody>
            {active.map(r => (
              <tr key={r.id}>
                <td><a href={`#/item/${r.item_id}`}>{r.item_name}</a></td>
                <td>{new Date(r.start_date).toLocaleString('de-DE')}</td>
                <td>{new Date(r.end_date).toLocaleString('de-DE')}</td>
                <td>{r.notes || '–'}</td>
                <td><button onClick={() => handleCancel(r.id)} className="btn btn-small btn-danger">Stornieren</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="empty">Keine aktiven Reservierungen.</p>}

      {past.length > 0 && (
        <>
          <h3 style={{ marginTop: '2rem' }}>Vergangene / Storniert</h3>
          <table className="table">
            <thead>
              <tr><th>Gerät</th><th>Von</th><th>Bis</th><th>Status</th></tr>
            </thead>
            <tbody>
              {past.map(r => (
                <tr key={r.id} className="row-muted">
                  <td>{r.item_name}</td>
                  <td>{new Date(r.start_date).toLocaleString('de-DE')}</td>
                  <td>{new Date(r.end_date).toLocaleString('de-DE')}</td>
                  <td><span className="badge badge-gray">{r.status === 'cancelled' ? 'Storniert' : r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// --- Admin: Users ---
function AdminUsersPage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'user' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.getUsers().then(setUsers).finally(() => setLoading(false));
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (!isAdmin) return <div className="page"><p>Kein Zugriff.</p></div>;

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createUser(form);
      setForm({ email: '', password: '', name: '', role: 'user' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleActive = async (user) => {
    await api.updateUser(user.id, { active: !user.active });
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Benutzer wirklich löschen?')) return;
    await api.deleteUser(id);
    load();
  };

  if (loading) return <div className="loading">Laden...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Benutzerverwaltung</h2>
        <div>
          <a href="#/admin/items" className="btn btn-small" style={{ marginRight: '0.5rem' }}>Geräte verwalten</a>
          <a href="#/admin/reservations" className="btn btn-small" style={{ marginRight: '0.5rem' }}>Alle Reservierungen</a>
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary btn-small">
            {showForm ? 'Abbrechen' : '+ Neuer Benutzer'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="form-card">
          <h3>Neuen Benutzer anlegen</h3>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <div className="form-group">
                <label>Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>E-Mail</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Passwort</label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required minLength="6" />
              </div>
              <div className="form-group">
                <label>Rolle</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="user">Benutzer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Anlegen</button>
          </form>
        </div>
      )}

      <table className="table">
        <thead>
          <tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Status</th><th>Aktionen</th></tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className={!u.active ? 'row-muted' : ''}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td><span className={`badge ${u.role === 'admin' ? 'badge-blue' : 'badge-gray'}`}>{u.role}</span></td>
              <td><span className={`badge ${u.active ? 'badge-green' : 'badge-red'}`}>{u.active ? 'Aktiv' : 'Deaktiviert'}</span></td>
              <td>
                <button onClick={() => handleToggleActive(u)} className="btn btn-small">
                  {u.active ? 'Deaktivieren' : 'Aktivieren'}
                </button>
                <button onClick={() => handleDelete(u.id)} className="btn btn-small btn-danger" style={{ marginLeft: '0.25rem' }}>Löschen</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Admin: Items ---
function AdminItemsPage() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', category: '', location: '' });
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.getItems().then(setItems).finally(() => setLoading(false));
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (!isAdmin) return <div className="page"><p>Kein Zugriff.</p></div>;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editId) {
        await api.updateItem(editId, form);
      } else {
        await api.createItem(form);
      }
      setForm({ name: '', description: '', category: '', location: '' });
      setShowForm(false);
      setEditId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (item) => {
    setForm({ name: item.name, description: item.description || '', category: item.category || '', location: item.location || '' });
    setEditId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Gerät wirklich löschen? Alle zugehörigen Reservierungen werden ebenfalls gelöscht.')) return;
    await api.deleteItem(id);
    load();
  };

  const handleToggleAvail = async (item) => {
    await api.updateItem(item.id, { available: !item.available });
    load();
  };

  if (loading) return <div className="loading">Laden...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Geräteverwaltung</h2>
        <div>
          <a href="#/admin/users" className="btn btn-small" style={{ marginRight: '0.5rem' }}>Benutzer verwalten</a>
          <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: '', description: '', category: '', location: '' }); }} className="btn btn-primary btn-small">
            {showForm ? 'Abbrechen' : '+ Neues Gerät'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="form-card">
          <h3>{editId ? 'Gerät bearbeiten' : 'Neues Gerät anlegen'}</h3>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Name *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Kategorie</label>
                <input value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="z.B. Elektronik, Werkzeug, Messgerät" />
              </div>
              <div className="form-group">
                <label>Standort</label>
                <input value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="z.B. Raum 201, Werkstatt" />
              </div>
            </div>
            <div className="form-group">
              <label>Beschreibung</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows="2" />
            </div>
            <button type="submit" className="btn btn-primary">{editId ? 'Speichern' : 'Anlegen'}</button>
          </form>
        </div>
      )}

      <table className="table">
        <thead>
          <tr><th>Name</th><th>Kategorie</th><th>Standort</th><th>Status</th><th>Aktionen</th></tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td><a href={`#/item/${item.id}`}>{item.name}</a></td>
              <td>{item.category || '–'}</td>
              <td>{item.location || '–'}</td>
              <td><span className={`badge ${item.available ? 'badge-green' : 'badge-red'}`}>{item.available ? 'Verfügbar' : 'Gesperrt'}</span></td>
              <td>
                <button onClick={() => handleEdit(item)} className="btn btn-small">Bearbeiten</button>
                <button onClick={() => handleToggleAvail(item)} className="btn btn-small" style={{ marginLeft: '0.25rem' }}>
                  {item.available ? 'Sperren' : 'Freigeben'}
                </button>
                <button onClick={() => handleDelete(item.id)} className="btn btn-small btn-danger" style={{ marginLeft: '0.25rem' }}>Löschen</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Admin: All Reservations ---
function AdminReservationsPage() {
  const { isAdmin } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.getReservations().then(setReservations).finally(() => setLoading(false));
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (!isAdmin) return <div className="page"><p>Kein Zugriff.</p></div>;
  if (loading) return <div className="loading">Laden...</div>;

  const handleCancel = async (id) => {
    if (!window.confirm('Reservierung stornieren?')) return;
    await api.cancelReservation(id);
    load();
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Alle Reservierungen</h2>
        <div>
          <a href="#/admin/users" className="btn btn-small" style={{ marginRight: '0.5rem' }}>Benutzer</a>
          <a href="#/admin/items" className="btn btn-small">Geräte</a>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr><th>Gerät</th><th>Benutzer</th><th>Von</th><th>Bis</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {reservations.map(r => (
            <tr key={r.id} className={r.status !== 'active' ? 'row-muted' : ''}>
              <td><a href={`#/item/${r.item_id}`}>{r.item_name}</a></td>
              <td>{r.user_name} ({r.user_email})</td>
              <td>{new Date(r.start_date).toLocaleString('de-DE')}</td>
              <td>{new Date(r.end_date).toLocaleString('de-DE')}</td>
              <td><span className={`badge ${r.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{r.status === 'active' ? 'Aktiv' : 'Storniert'}</span></td>
              <td>
                {r.status === 'active' && (
                  <button onClick={() => handleCancel(r.id)} className="btn btn-small btn-danger">Stornieren</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {reservations.length === 0 && <p className="empty">Keine Reservierungen.</p>}
    </div>
  );
}

// --- Router ---
function Router() {
  const hash = useHash();

  const match = hash.match(/^#\/item\/(\d+)$/);
  if (match) return <ItemDetailPage id={match[1]} />;

  switch (hash) {
    case '#/':
    case '#':
      return <ItemsPage />;
    case '#/reservierungen':
      return <MyReservationsPage />;
    case '#/admin/users':
      return <AdminUsersPage />;
    case '#/admin/items':
      return <AdminItemsPage />;
    case '#/admin/reservations':
      return <AdminReservationsPage />;
    default:
      return <ItemsPage />;
  }
}

// --- App ---
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user } = useAuth();

  if (!user) return <LoginPage />;

  return (
    <div className="app">
      <Nav />
      <main className="main">
        <Router />
      </main>
    </div>
  );
}

export default App;
