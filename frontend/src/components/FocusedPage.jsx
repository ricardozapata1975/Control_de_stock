export default function FocusedPage({ children, maxWidth = 'max-w-lg' }) {
  return (
    <div className="flex w-full flex-1 flex-col items-center py-4 sm:py-6">
      <div className={`w-full ${maxWidth} mx-auto`}>{children}</div>
    </div>
  );
}
