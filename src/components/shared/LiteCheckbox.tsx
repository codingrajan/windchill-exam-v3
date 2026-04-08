export default function LiteCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      aria-checked={checked}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0"
      style={{
        background: checked ? '#4F46E5' : '#FFF',
        borderColor: checked ? '#4F46E5' : '#D4D4D8',
        boxShadow: checked ? '0 0 0 3px rgba(79,70,229,0.15)' : 'none',
      }}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
