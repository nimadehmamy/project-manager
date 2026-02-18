import { useState, useEffect } from 'react';
import { User, Lock, Save, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { api } from '../../api/client';

export function ProfilePage() {
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load current profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await api.getProfile();
        setUsername(data.username);
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
    };
    loadProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validation
    if (!currentPassword) {
      setMessage({ type: 'error', text: 'Current password is required' });
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (!newUsername && !newPassword) {
      setMessage({ type: 'error', text: 'No changes specified' });
      return;
    }

    setLoading(true);
    try {
      await api.updateProfile(
        currentPassword,
        newUsername || undefined,
        newPassword || undefined
      );
      
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      
      // Update displayed username
      if (newUsername) {
        setUsername(newUsername);
      }
      
      // Clear form
      setCurrentPassword('');
      setNewUsername('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.error || 'Failed to update profile' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>
          <User size={24} />
          Profile Settings
        </h1>
        <p>Update your login credentials</p>
      </div>

      <div className="profile-card">
        <div className="profile-current">
          <div className="profile-avatar">
            <User size={32} />
          </div>
          <div className="profile-info">
            <h3>Current User</h3>
            <p>{username}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="profile-form">
          {message && (
            <div className={`alert alert-${message.type}`}>
              {message.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
              {message.text}
            </div>
          )}

          <div className="form-section">
            <h4>
              <Lock size={16} />
              Security Verification
            </h4>
            <div className="form-group">
              <label>Current Password *</label>
              <div className="password-input-wrapper">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPasswords(!showPasswords)}
                >
                  {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>
              <User size={16} />
              Update Username (optional)
            </h4>
            <div className="form-group">
              <label>New Username</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Leave blank to keep current"
                minLength={3}
              />
              <small>Minimum 3 characters</small>
            </div>
          </div>

          <div className="form-section">
            <h4>
              <Lock size={16} />
              Update Password (optional)
            </h4>
            <div className="form-group">
              <label>New Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                  minLength={6}
                />
              </div>
              <small>Minimum 6 characters</small>
            </div>

            {newPassword && (
              <div className="form-group">
                <label>Confirm New Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="form-actions">
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                'Saving...'
              ) : (
                <>
                  <Save size={16} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
