import React, { useState } from "react";
import Icon from "../UI/Icon";
import { API_URL } from "../shared/api/client";

function AuthPanel({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [accountType, setAccountType] = useState("user");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [requiresPasscode, setRequiresPasscode] = useState(false);
  const [secureEmail, setSecureEmail] = useState("");
  const [securePasscode, setSecurePasscode] = useState("");

  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  const saveLogin = (result) => {
    localStorage.setItem("rta_token", result.token);
    localStorage.setItem("rta_current_user", JSON.stringify(result.user));

    alert(result.message || "Login successful.");
    onLogin(result.user);
  };

  const resetNormalForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setAccountType("user");
  };

  const resetSecureForm = () => {
    setRequiresPasscode(false);
    setSecureEmail("");
    setSecurePasscode("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      alert("Please enter email and password.");
      return;
    }

    if (isSignup && !name.trim()) {
      alert("Please enter your name.");
      return;
    }

    try {
      setLoading(true);

      const endpoint = isSignup
        ? `${API_URL}/api/auth/signup`
        : `${API_URL}/api/auth/login`;

      const payload = isSignup
        ? {
            name,
            email,
            password,
            accountType,
            account_type: accountType,
          }
        : {
            email,
            password,
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.requiresPasscode) {
          setSecureEmail(result.email || email);
          setSecurePasscode("");
          setRequiresPasscode(true);
          return;
        }

        throw new Error(result.message || "Authentication failed.");
      }

      if (result.requiresPasscode) {
        setSecureEmail(result.email || email);
        setSecurePasscode("");
        setRequiresPasscode(true);
        resetNormalForm();
        return;
      }

      if (!result.user || !result.token) {
        alert(result.message || "Signup successful. Please wait for approval.");
        setMode("login");
        resetNormalForm();
        return;
      }

      saveLogin(result);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSecureVerification = async (e) => {
    e.preventDefault();

    if (!securePasscode.trim()) {
      alert("Please enter your secure passcode.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/auth/verify-passcode`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: secureEmail,
          passcode: securePasscode,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Secure verification failed.");
      }

      resetSecureForm();
      resetNormalForm();
      saveLogin(result);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(isSignup ? "login" : "signup");
    resetNormalForm();
    resetSecureForm();
  };

  const authForm = requiresPasscode ? (
    <form className="auth-form" onSubmit={handleSecureVerification}>
      <h2>Secure Verification</h2>
      <p className="auth-footer-text">
        Enter your secure passcode to finish account setup.
      </p>

      <label htmlFor="securePasscode">Secure Passcode</label>
      <div className="auth-input-wrap">
        <span className="auth-input-icon">
          <Icon name="shield" size={16} />
        </span>
        <input
          id="securePasscode"
          className="auth-input"
          type="password"
          value={securePasscode}
          onChange={(e) => setSecurePasscode(e.target.value)}
          placeholder="Enter secure passcode"
          autoComplete="off"
        />
      </div>

      <button type="submit" className="auth-submit-btn" disabled={loading}>
        {loading ? (
          <>
            <Icon name="loader" size={16} className="spin" /> Verifying...
          </>
        ) : (
          <>
            <Icon name="shield" size={16} /> Verify
          </>
        )}
      </button>

      <button
        type="button"
        className="auth-submit-btn secondary"
        disabled={loading}
        onClick={() => {
          resetSecureForm();
          setMode("login");
        }}
      >
        <Icon name="arrowLeft" size={16} /> Back to Login
      </button>
    </form>
  ) : (
    <>
      <div className="auth-tabs">
        <button
          type="button"
          className={mode === "login" ? "active" : ""}
          onClick={() => {
            setMode("login");
            resetNormalForm();
            resetSecureForm();
          }}
        >
          <Icon name="login" size={16} /> Login
        </button>

        <button
          type="button"
          className={mode === "signup" ? "active" : ""}
          onClick={() => {
            setMode("signup");
            resetNormalForm();
            resetSecureForm();
          }}
        >
          <Icon name="userPlus" size={16} /> Sign Up
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {isSignup && (
          <>
            <label>Account Type</label>

            <div className="account-type-row">
              <button
                type="button"
                className={accountType === "user" ? "selected" : ""}
                onClick={() => setAccountType("user")}
              >
                <Icon name="user" size={16} /> User
              </button>

              <button
                type="button"
                className={accountType === "admin" ? "selected" : ""}
                onClick={() => setAccountType("admin")}
              >
                <Icon name="shield" size={16} /> Admin
              </button>
            </div>

            <label htmlFor="name">Full Name</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">
                <Icon name="user" size={16} />
              </span>
              <input
                id="name"
                className="auth-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>
          </>
        )}

        <label htmlFor="email">Email</label>
        <div className="auth-input-wrap">
          <span className="auth-input-icon">
            <Icon name="mail" size={16} />
          </span>
          <input
            id="email"
            className="auth-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
          />
        </div>

        <label htmlFor="password">Password</label>
        <div className="auth-input-wrap">
          <span className="auth-input-icon">
            <Icon name="shield" size={16} />
          </span>
          <input
            id="password"
            className="auth-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
        </div>

        <button type="submit" className="auth-submit-btn" disabled={loading}>
          {loading ? (
            <>
              <Icon name="loader" size={16} className="spin" /> Please wait...
            </>
          ) : isSignup ? (
            <>
              <Icon name="userPlus" size={16} /> Create Account
            </>
          ) : (
            <>
              <Icon name="login" size={16} /> Login
            </>
          )}
        </button>
      </form>

      <p className="auth-footer-text">
        {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
        <button type="button" onClick={switchMode}>
          {isSignup ? "Login" : "Sign up"}
        </button>
      </p>
    </>
  );

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <div className="auth-hero-content">
          <div className="auth-hero-badge">
            <Icon name="zap" size={14} />
            Fast Resume Tailor
          </div>

          <h1>Apply smarter. Land faster.</h1>
          <p>
            Tailor resumes to every job description, track applications per
            profile, and move through your pipeline with precision.
          </p>

          <div className="auth-hero-features">
            <div className="auth-hero-feature">
              <div className="auth-hero-feature-icon">
                <Icon name="wand" size={18} />
              </div>
              <div>
                <strong>AI-ready prompts</strong>
                <span>Generate tailored resume prompts from any job description.</span>
              </div>
            </div>

            <div className="auth-hero-feature">
              <div className="auth-hero-feature-icon">
                <Icon name="fileText" size={18} />
              </div>
              <div>
                <strong>Template-driven resumes</strong>
                <span>Fill admin DOCX templates and export polished PDFs instantly.</span>
              </div>
            </div>

            <div className="auth-hero-feature">
              <div className="auth-hero-feature-icon">
                <Icon name="briefcase" size={18} />
              </div>
              <div>
                <strong>Application tracking</strong>
                <span>Monitor every apply by profile, company, and role.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="auth-brand-mark">
              <Icon name="zap" size={26} strokeWidth={2.5} />
            </div>
            <h1>FRT</h1>
            <p>Whatever you think, think bigger</p>
          </div>

          {authForm}
        </div>
      </section>
    </main>
  );
}

export default AuthPanel;
