import { useState, type FormEvent, type ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import { updateProfile } from '../../api/auth';
import './auth.css';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(user?.avatar_url ?? null);
  const [submitting, setSubmitting] = useState(false);

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await updateProfile({
        display_name: displayName,
        ...(avatarFile ? { avatar: avatarFile } : {}),
      });
      setUser(data);
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  }

  const initials = (user?.display_name || user?.username || '?')[0].toUpperCase();

  return (
    <div className="auth-page">
      <div className="auth-page__blob auth-page__blob--1" />
      <div className="auth-page__blob auth-page__blob--2" />
      <div className="auth-page__blob auth-page__blob--3" />
      <div className="auth-page__grid" />

      <div className="auth-card">
        <div className="auth-card__border">
          <div className="auth-card__inner">

            <div className="auth-card__logo">
              <div className="auth-card__logo-mark">✂</div>
              <span className="auth-card__logo-text">Auracut</span>
            </div>

            {/* avatar */}
            <div className="profile-avatar-ring">
              {preview
                ? <img className="profile-avatar-img" src={preview} alt="avatar" />
                : <div className="profile-avatar-placeholder">{initials}</div>
              }
              <label className="profile-avatar-change">
                Change photo
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              </label>
            </div>

            <h1 className="auth-card__heading">Your profile</h1>
            <p className="auth-card__sub">Update your display name and avatar.</p>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label className="auth-field__label">Display name</label>
                <input
                  className="auth-field__input"
                  type="text"
                  placeholder="How should we call you?"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div className="auth-field">
                <label className="auth-field__label">Username</label>
                <input
                  className="auth-field__input"
                  type="text"
                  value={user?.username ?? ''}
                  disabled
                  style={{ opacity: 0.4, cursor: 'not-allowed' }}
                />
              </div>

              <button className="auth-submit" type="submit" disabled={submitting}>
                {submitting && <span className="auth-submit__spinner" />}
                {submitting ? 'Saving…' : 'Save changes'}
              </button>
            </form>

            <p className="auth-footer">
              <Link to="/">← Back to dashboard</Link>
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}
