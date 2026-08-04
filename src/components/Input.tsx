import './Input.css';

type InputProps = {
  label: string;
  value?: string;
  placeholder?: string;
  error?: string;
};

export function Input({ label, value = '', placeholder, error }: InputProps) {
  return (
    <label className="input">
      <span className="input__label">{label}</span>
      <input
        className={`input__control${error ? ' input__control--error' : ''}`}
        type="text"
        value={value}
        placeholder={placeholder}
        readOnly
      />
      {error ? <span className="input__error">{error}</span> : null}
    </label>
  );
}
