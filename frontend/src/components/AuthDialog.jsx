import { useEffect, useState } from "react";
import { BrandMark } from "./BrandMark";

const INITIAL_FORM = {
  username: "",
  password: "",
  displayName: "",
};

export function AuthDialog({ open, mode, loading = false, error = "", onClose, onModeChange, onLogin, onRegister }) {
  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    if (open) {
      setForm(INITIAL_FORM);
    }
  }, [open, mode]);

  if (!open) {
    return null;
  }

  const isRegister = mode === "register";

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isRegister) {
      await onRegister(form);
      return;
    }
    await onLogin(form);
  };

  return (
    <div className="auth-dialog" role="dialog" aria-modal="true" aria-label="登录与注册">
      <div className="auth-dialog__backdrop" onClick={onClose} />
      <div className="auth-dialog__panel">
        <div className="auth-dialog__hero">
          <BrandMark />
          <h2>进入植物病害智能工作台</h2>
          <p>登录后会直接进入当前工作区，识别、标注、训练和管理都在这一个站点里完成。</p>
          <ul className="auth-dialog__list">
            <li>登录后会自动恢复到你当前选中的工作区。</li>
            <li>识别结果可以继续流转到标注与训练模块。</li>
            <li>管理员账号登录后会看到模型和数据集管理入口。</li>
          </ul>
        </div>
        <div className="auth-dialog__form-wrap">
          <div className="auth-tabs" role="tablist" aria-label="登录注册切换">
            <button type="button" className={`auth-tabs__tab${!isRegister ? " is-active" : ""}`} onClick={() => onModeChange("login")}>
              登录
            </button>
            <button type="button" className={`auth-tabs__tab${isRegister ? " is-active" : ""}`} onClick={() => onModeChange("register")}>
              注册
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister ? (
              <label className="field">
                <span>显示名称</span>
                <input
                  value={form.displayName}
                  onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                  placeholder="例如 张三"
                  autoComplete="nickname"
                />
              </label>
            ) : null}
            <label className="field">
              <span>用户名</span>
              <input
                value={form.username}
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                placeholder="请输入用户名"
                autoComplete="username"
              />
            </label>
            <label className="field">
              <span>密码</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="请输入密码"
                autoComplete={isRegister ? "new-password" : "current-password"}
              />
            </label>
            {error ? <p className="auth-form__error">{error}</p> : null}
            <div className="auth-form__actions">
              <button type="submit" className="primary" disabled={loading}>
                {loading ? "处理中..." : isRegister ? "注册并进入" : "登录并进入"}
              </button>
              <button type="button" className="secondary" onClick={onClose}>
                关闭
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
