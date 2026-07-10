import { useState, type FormEvent, type ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/useAuthStore';
import { updateProfile } from '../../api/auth';

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

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Profile</h1>

        {preview && (
          <img
            src={preview}
            alt="avatar"
            style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }}
          />
        )}

        <label>
          Avatar
          <input type="file" accept="image/*" onChange={handleAvatarChange} />
        </label>

        <label>
          Display name
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
