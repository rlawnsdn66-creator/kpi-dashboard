import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import Modal from '../components/common/Modal';
import { getOrgTree, getOrgLevels, createOrganization, updateOrganization, deleteOrganization, getUsers, createUser, updateUser, deleteUser } from '../api';

function OrgTreeNode({ node, selected, onSelect, depth = 0 }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className={`panel-item ${selected?.id === node.id ? 'active' : ''}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => onSelect(node)}
      >
        {hasChildren ? (
          <span className="tree-toggle" onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}>
            {expanded ? '▼' : '▶'}
          </span>
        ) : <span className="tree-toggle" style={{ visibility: 'hidden' }}>▶</span>}
        <span className="tree-label">{node.level_label && <small style={{ color: '#888', marginRight: 4 }}>[{node.level_label}]</small>}{node.name}</span>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map(child => (
            <OrgTreeNode key={child.id} node={child} selected={selected} onSelect={onSelect} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeamPage() {
  const [tree, setTree] = useState([]);
  const [levels, setLevels] = useState([]);
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [orgModal, setOrgModal] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [orgForm, setOrgForm] = useState({ name: '', description: '', level_id: '', parent_id: null });
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'member' });
  const [editId, setEditId] = useState(null);
  const [editType, setEditType] = useState(null);

  const loadAll = async () => {
    const [t, l, u] = await Promise.all([getOrgTree(), getOrgLevels(), getUsers()]);
    setTree(t);
    setLevels(l);
    setUsers(u);
  };

  useEffect(() => { loadAll(); }, []);

  const filteredUsers = selected ? users.filter(u => u.organization_id === selected.id) : [];

  // 조직 CRUD
  const openOrgCreate = (parent = null) => {
    const nextLevel = parent ? levels.find(l => l.depth > (parent.level_depth || 0)) : levels[0];
    setOrgForm({ name: '', description: '', level_id: nextLevel?.id || '', parent_id: parent?.id || null });
    setEditId(null);
    setEditType('org');
    setOrgModal(true);
  };
  const openOrgEdit = (org) => {
    setOrgForm({ name: org.name, description: org.description || '', level_id: org.level_id, parent_id: org.parent_id });
    setEditId(org.id);
    setEditType('org');
    setOrgModal(true);
  };
  const handleOrgSubmit = async (e) => {
    e.preventDefault();
    if (editId) await updateOrganization(editId, orgForm);
    else await createOrganization(orgForm);
    setOrgModal(false);
    loadAll();
  };
  const handleOrgDelete = async (id) => {
    if (!confirm('조직을 삭제하시겠습니까? 하위 조직도 함께 삭제됩니다.')) return;
    await deleteOrganization(id);
    if (selected?.id === id) setSelected(null);
    loadAll();
  };

  // 멤버 CRUD
  const openUserCreate = () => { setUserForm({ name: '', email: '', role: 'member' }); setEditId(null); setEditType('user'); setUserModal(true); };
  const openUserEdit = (u) => { setUserForm({ name: u.name, email: u.email || '', role: u.role }); setEditId(u.id); setEditType('user'); setUserModal(true); };
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (editId) await updateUser(editId, userForm);
    else await createUser({ ...userForm, organization_id: selected.id });
    setUserModal(false);
    loadAll();
  };
  const handleUserDelete = async (id) => {
    if (!confirm('멤버를 삭제하시겠습니까?')) return;
    await deleteUser(id);
    loadAll();
  };

  const roleLabel = { admin: '관리자', manager: '매니저', member: '멤버' };

  return (
    <div className="page">
      <Header title="조직 관리" />
      <div className="team-layout">
        <div className="team-panel">
          <div className="panel-header">
            <h3>조직 구조</h3>
            <button className="btn btn--sm btn--primary" onClick={() => openOrgCreate(null)}>+ 추가</button>
          </div>
          <div className="panel-list">
            {tree.map(node => (
              <OrgTreeNode key={node.id} node={node} selected={selected} onSelect={setSelected} />
            ))}
            {tree.length === 0 && <div className="empty-state">조직이 없습니다</div>}
          </div>
        </div>

        <div className="team-panel team-panel--wide">
          {selected ? (
            <>
              <div className="panel-header">
                <h3>{selected.level_label}: {selected.name}</h3>
                <div className="action-buttons">
                  <button className="btn btn--sm btn--primary" onClick={() => openOrgCreate(selected)}>+ 하위 조직</button>
                  <button className="btn btn--sm" onClick={() => openOrgEdit(selected)}>수정</button>
                  <button className="btn btn--sm btn--danger" onClick={() => handleOrgDelete(selected.id)}>삭제</button>
                </div>
              </div>
              {selected.description && <p style={{ padding: '0 16px', color: '#666' }}>{selected.description}</p>}

              <div style={{ padding: '16px' }}>
                <div className="panel-header">
                  <h4>소속 멤버</h4>
                  <button className="btn btn--sm btn--primary" onClick={openUserCreate}>+ 멤버 추가</button>
                </div>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead><tr><th>이름</th><th>이메일</th><th>역할</th><th></th></tr></thead>
                    <tbody>
                      {filteredUsers.map(u => (
                        <tr key={u.id}>
                          <td>{u.name}</td>
                          <td>{u.email || '-'}</td>
                          <td>{roleLabel[u.role] || u.role}</td>
                          <td>
                            <div className="action-buttons">
                              <button className="btn btn--xs" onClick={() => openUserEdit(u)}>수정</button>
                              <button className="btn btn--xs btn--danger" onClick={() => handleUserDelete(u.id)}>삭제</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && <tr><td colSpan={4} className="empty-state">멤버가 없습니다</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : <div className="empty-state">조직을 선택하세요</div>}
        </div>
      </div>

      <Modal isOpen={orgModal} onClose={() => setOrgModal(false)} title={editId ? '조직 수정' : '조직 추가'}>
        <form onSubmit={handleOrgSubmit} className="form">
          <label>조직명 <input required value={orgForm.name} onChange={e => setOrgForm({...orgForm, name: e.target.value})} /></label>
          <label>레벨 <select required value={orgForm.level_id} onChange={e => setOrgForm({...orgForm, level_id: Number(e.target.value)})}>
            <option value="">선택</option>
            {levels.map(l => <option key={l.id} value={l.id}>{l.label} ({l.name})</option>)}
          </select></label>
          <label>설명 <textarea value={orgForm.description} onChange={e => setOrgForm({...orgForm, description: e.target.value})} /></label>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setOrgModal(false)}>취소</button>
            <button type="submit" className="btn btn--primary">{editId ? '수정' : '추가'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={userModal} onClose={() => setUserModal(false)} title={editId ? '멤버 수정' : '멤버 추가'}>
        <form onSubmit={handleUserSubmit} className="form">
          <label>이름 <input required value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} /></label>
          <label>이메일 <input type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} /></label>
          <label>역할 <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
            <option value="member">멤버</option>
            <option value="manager">매니저</option>
            <option value="admin">관리자</option>
          </select></label>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setUserModal(false)}>취소</button>
            <button type="submit" className="btn btn--primary">{editId ? '수정' : '추가'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
