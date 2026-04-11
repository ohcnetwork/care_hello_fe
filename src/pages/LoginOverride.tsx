import React, { useContext, useState } from "react";
import { useTranslation } from "react-i18next";

import "./LoginOverride.css";

type LoginOverrideProps = {
  forgot?: boolean;
};

/**
 * Plugin-owned Login override with functional authentication.
 *
 * Uses `window.AuthUserContext` (set by the host in src/index.tsx) to call
 * `signIn` — works because `react` is a shared dependency so `useContext`
 * resolves against the same provider the host mounted.
 */
export default function LoginOverride(props: LoginOverrideProps) {
  const { t } = useTranslation();
  const auth = useContext(window.AuthUserContext);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [forgotMode, setForgotMode] = useState(props.forgot ?? false);
  const [errors, setErrors] = useState<{
    username?: string;
    password?: string;
  }>({});
  const [globalError, setGlobalError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError("");
    const errs: typeof errors = {};

    if (!username.trim()) errs.username = t("field_required");
    if (!forgotMode && !password) errs.password = t("field_required");

    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});

    if (forgotMode) {
      try {
        const res = await fetch(
          `${window.CARE_API_URL}/api/v1/password_reset/`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: username.toLowerCase() }),
          },
        );
        if (res.ok) {
          setGlobalError(t("password_sent"));
        } else {
          setGlobalError(t("something_went_wrong"));
        }
      } catch {
        setGlobalError(t("something_went_wrong"));
      }
      return;
    }

    try {
      await auth?.signIn({
        username: username.toLowerCase(),
        password,
      });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "status" in err &&
        (err as { status: number }).status === 429
      ) {
        setGlobalError(t("too_many_attempts"));
      }
    }
  };

  const isLoading = auth?.isAuthenticating ?? false;

  return (
    <div className="login-override">
      <div className="login-override__inner">
        <div className="login-override__header">
          <p className="login-override__badge">care hello</p>
          <h1 className="login-override__title">
            {forgotMode ? t("forget_password") : t("welcome_back")}
          </h1>
          <p className="login-override__subtitle">
            {forgotMode
              ? t("forget_password_instruction")
              : t("auth_login_title")}
          </p>
        </div>

        <div className="login-override__card">
          <form className="login-override__form" onSubmit={handleSubmit}>
            <div className="login-override__field">
              <label className="login-override__label" htmlFor="lo-username">
                {t("username")}
              </label>
              <input
                id="lo-username"
                className={`login-override__input${errors.username ? "login-override__input--error" : ""}`}
                type="text"
                autoComplete="username"
                placeholder={t("username")}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrors((prev) => ({ ...prev, username: undefined }));
                }}
              />
              {errors.username && (
                <p className="login-override__error">{errors.username}</p>
              )}
            </div>

            {!forgotMode && (
              <div className="login-override__field">
                <label className="login-override__label" htmlFor="lo-password">
                  {t("password")}
                </label>
                <input
                  id="lo-password"
                  className={`login-override__input${errors.password ? "login-override__input--error" : ""}`}
                  type="password"
                  autoComplete="current-password"
                  placeholder={t("password")}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                />
                {errors.password && (
                  <p className="login-override__error">{errors.password}</p>
                )}
              </div>
            )}

            {globalError && (
              <p className="login-override__global-error">{globalError}</p>
            )}

            <button
              type="submit"
              className="login-override__button"
              disabled={isLoading}
            >
              {isLoading
                ? "..."
                : forgotMode
                  ? t("send_reset_link")
                  : t("login")}
            </button>

            <button
              type="button"
              className="login-override__forgot"
              onClick={() => {
                setForgotMode((prev) => !prev);
                setErrors({});
                setGlobalError("");
              }}
            >
              {forgotMode ? t("back_to_login") : t("forget_password")}
            </button>
          </form>
        </div>

        <p className="login-override__footer">
          Powered by care_hello_fe plugin override
        </p>
      </div>
    </div>
  );
}
