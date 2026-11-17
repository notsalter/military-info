import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function ModalDialog({ isOpen, onClose, title, closeLabel, className = '', children }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    const overflow = document.body.style.overflow;
    const background = [...document.body.children].filter((element) => element !== dialog);
    const previousInert = background.map((element) => element.hasAttribute('inert'));
    background.forEach((element) => element.setAttribute('inert', ''));
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    dialog.querySelector('button')?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')]
        .sort((left, right) => left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    dialog.addEventListener('keydown', handleKeyDown);
    return () => {
      dialog.removeEventListener('keydown', handleKeyDown);
      dialog.close();
      background.forEach((element, index) => { if (!previousInert[index]) element.removeAttribute('inert'); });
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus();
      else document.querySelector('main')?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;
  return createPortal(
    <dialog ref={dialogRef} aria-labelledby={titleId} className={`modal-dialog ${className}`}
      onCancel={(event) => { event.preventDefault(); onCloseRef.current(); }}>
      <div className="dialog-header"><h2 id={titleId}>{title}</h2>
        <button type="button" aria-label={closeLabel || `Close ${title.toLowerCase()}`} onClick={onClose}>Close</button></div>
      {children}
    </dialog>, document.body,
  );
}
