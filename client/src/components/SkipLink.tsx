export interface SkipLinkProps {
  targetId?: string;
  children?: string;
}

export function SkipLink({
  targetId = "main",
  children = "Skip to main content",
}: SkipLinkProps) {
  return (
    <a className="sot-skip" href={`#${targetId}`}>
      {children}
    </a>
  );
}
