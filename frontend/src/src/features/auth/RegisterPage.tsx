import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/useAuthStore';
import './auth.css';

interface FieldErrors {
  username?: string;
  email?: string;
  password?: string;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const e: FieldErrors = {};
    if (!username.trim()) e.username = 'Username is required';
    if (!email.includes('@')) e.email = 'Valid email is required';
    if (password.length < 8) e.password = 'At least 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await register(username, email, password);
      navigate('/');
    } catch (err: unknown) {
      const responseData = (err as { response?: { data?: Record<string, unknown> } }).response?.data;
      // The backend global_exception_handler wraps errors as:
      //   { error: true, detail: { field: ['msg', ...] }, status_code: N }
      // Unwrap the 'detail' layer; fall back to the raw response if not wrapped.
      const fieldErrors = (
        responseData?.detail && typeof responseData.detail === 'object'
          ? responseData.detail
          : responseData
      ) as Record<string, string[]> | undefined;

      if (fieldErrors) {
        const newErrors: FieldErrors = {};
        if (fieldErrors.username?.[0]) newErrors.username = fieldErrors.username[0];
        if (fieldErrors.email?.[0]) newErrors.email = fieldErrors.email[0];
        if (fieldErrors.password?.[0]) newErrors.password = fieldErrors.password[0];
        // Handle non_field_errors or top-level string messages
        const nonField = fieldErrors.non_field_errors?.[0] ?? (typeof fieldErrors === 'string' ? fieldErrors : null);
        if (nonField) toast.error(nonField);
        if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors);
        } else if (!nonField) {
          toast.error('Registration failed. Please try again.');
        }
      } else {
        toast.error('Registration failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

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

            <h1 className="auth-card__heading">Create account</h1>
            <p className="auth-card__sub">Start editing videos for free. No credit card needed.</p>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>

              <div className="auth-field">
                <label className="auth-field__label">Username</label>
                <input
                  className="auth-field__input"
                  type="text"
                  placeholder="yourname"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
                {errors.username && <span className="auth-field__error">⚠ {errors.username}</span>}
              </div>

              <div className="auth-field">
                <label className="auth-field__label">Email</label>
                <input
                  className="auth-field__input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                {errors.email && <span className="auth-field__error">⚠ {errors.email}</span>}
              </div>

              <div className="auth-field">
                <label className="auth-field__label">Password</label>
                <input
                  className="auth-field__input"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                {errors.password && <span className="auth-field__error">⚠ {errors.password}</span>}
              </div>

              <button className="auth-submit" type="submit" disabled={submitting}>
                {submitting && <span className="auth-submit__spinner" />}
                {submitting ? 'Creating account…' : 'Get started free'}
              </button>

            </form>

            <p className="auth-footer">
              Already have an account?{' '}
              <Link to="/login">Sign in</Link>
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}
