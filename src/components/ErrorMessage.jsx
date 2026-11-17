export default function ErrorMessage({ message, onRetry }) {
  return <div className="error-state"><p role="alert">{message}</p>
    {onRetry && <button type="button" onClick={onRetry}>Retry news</button>}</div>;
}
