import { Crown, FolderOpen, Image, LayoutGrid, LogOut, Plus, Search, Upload } from 'lucide-react';
import { getFirebaseAuth } from '../lib/firebase';
import '../projects/dashboard.css';
import '../projects/all-projects.css';
import '../projects/sidebar.css';

/** Decorative workspace shell: no project reads, actions, or editor are mounted. */
export default function LockedDashboardPreview() {
  const user = getFirebaseAuth().currentUser;
  const name = user?.displayName || user?.email?.split('@')[0] || 'Personal workspace';
  return <div className="paid-access-preview" inert aria-hidden="true">
    <div className="pd-dashboard pd-all-projects">
      <aside className="pd-sidebar">
        <div className="pd-account"><div className="pd-avatar">{name.charAt(0).toUpperCase()}</div><div><strong>{name}</strong><span>Personal workspace</span></div></div>
        <div className="pd-nav-label">WORKSPACE</div>
        <nav><button className="is-selected" tabIndex={-1}><LayoutGrid size={18} />All projects<span>0</span></button><button tabIndex={-1}><Image size={18} />PNG → SVG<span className="pd-nav-new">New</span></button></nav>
        <div className="pd-nav-label pd-library-label">LIBRARY</div><nav><button tabIndex={-1}><FolderOpen size={18} />My assets</button></nav>
        <div className="pd-sidebar-bottom"><section className="pd-upgrade"><h2><Crown size={17} />Upgrade for more</h2><p>Explore plans for more storage and creative possibilities.</p><div className="paid-preview-upgrade">Upgrade plan ↗</div></section><button className="pd-logout" tabIndex={-1}><LogOut size={20} />Log out</button></div>
      </aside>
      <main className="pd-main"><div className="pd-content">
        <div className="ap-topbar"><div className="pd-search"><Search size={16} /><span>Search projects...</span><kbd>Ctrl K</kbd></div><div className="ap-account"><span className="pd-avatar">{name.charAt(0).toUpperCase()}</span><strong>{name}</strong></div></div>
        <header className="pd-header"><div><div className="ap-eyebrow">PROJECTS</div><h1>All projects</h1><p>Pick up where you left off, or start something new.</p></div><div className="pd-header-actions"><button className="pd-button" tabIndex={-1}><Upload size={16} />Import</button><button className="pd-button pd-primary" tabIndex={-1}><Plus size={18} />New project</button></div><div className="ap-hero-art"><div className="ap-folder ap-folder-back" /><div className="ap-folder ap-folder-front"><div className="ap-picture"><svg viewBox="0 0 100 90"><circle cx="75" cy="23" r="10" /><path d="M7 77L33 40Q36 35 40 40L52 56L67 38Q70 34 74 39L95 77Z" /></svg></div></div></div></header>
        <div className="pd-list-toolbar"><div className="ap-types">{['All', 'SVG', 'Lottie', 'Video', 'Images'].map(type => <button key={type} className={type === 'All' ? 'is-active' : ''} tabIndex={-1}>{type === 'All' && <LayoutGrid size={14} />}{type}</button>)}</div><div className="ap-toolbar-actions"><span>Recently active⌄</span><span>Filter⌄</span></div></div>
      </div></main>
    </div>
  </div>;
}
