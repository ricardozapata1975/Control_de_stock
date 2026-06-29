export default function FocusedPage({ children, maxWidth = 'max-w-lg' }) {
  return (
    <div className="flex w-full min-w-0 flex-col items-stretch py-4 sm:py-6 md:flex-1 md:items-center md:justify-center">
      <div className={`w-full min-w-0 ${maxWidth} md:mx-auto`}>{children}</div>
    </div>
  );
}
