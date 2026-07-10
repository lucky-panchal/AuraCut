import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as authApi from '../../api/auth';
import useAuthStore from '../../store/useAuthStore';

interface FieldErrors {
  username?: string;
  email?: string;
  password?: string;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const e: FieldErrors = {};
    if (!username.trim()) e.username = 'Username is required';
    if (!email.includes('@')) e.email = 'Valid email is required';
    if (password.length < 8) e.password = 'Password must be at least 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await authApi.register({ username, email, password });
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string[]> } }).response?.data;
      if (data) {
        setErrors({
          username: data.username?.[0],
          email: data.email?.[0],
          password: data.password?.[0],
        });
      } else {
        toast.error('Registration failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <h1>Create account</h1>

        <label>
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          {errors.username && <span className="field-error">{errors.username}</span>}
        </label>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          {errors.password && <span className="field-error">{errors.password}</span>}
        </label>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Register'}
        </button>

        <p>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
