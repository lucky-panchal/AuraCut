import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/useAuthStore';
import './auth.css';

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const e: FieldErrors = {};
    if (!email.includes('@')) e.email = 'Valid email is required';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch {
      toast.error('Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      {/* animated blobs */}
      <div className="auth-page__blob auth-page__blob--1" />
      <div className="auth-page__blob auth-page__blob--2" />
      <div className="auth-page__blob auth-page__blob--3" />
      <div className="auth-page__grid" />

      <div className="auth-card">
        <div className="auth-card__border">
          <div className="auth-card__inner">

            {/* logo */}
            <div className="auth-card__logo">
              <div className="auth-card__logo-mark">✂</div>
              <span className="auth-card__logo-text">Auracut</span>
            </div>

            <h1 className="auth-card__heading">Welcome back</h1>
            <p className="auth-card__sub">Sign in to continue editing your projects.</p>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>

              <div className="auth-field">
                <label className="auth-field__label">Email</label>
                <div className="auth-field__input-wrap">
                  <input
                    className="auth-field__input"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                {errors.email && <span className="auth-field__error">⚠ {errors.email}</span>}
              </div>

              <div className="auth-field">
                <label className="auth-field__label">Password</label>
                <div className="auth-field__input-wrap">
                  <input
                    className="auth-field__input"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                {errors.password && <span className="auth-field__error">⚠ {errors.password}</span>}
              </div>

              <button className="auth-submit" type="submit" disabled={submitting}>
                {submitting && <span className="auth-submit__spinner" />}
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="auth-footer">
              No account?{' '}
              <Link to="/register">Create one free</Link>
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}
