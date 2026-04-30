export interface DiffFile {
  path: string;
  diff: string;
  additions: number;
  deletions: number;
}

interface DiffSidebarProps {
  files: DiffFile[];
  activeFile: string;
  referencedFile: string;
  onFileSelect: (path: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

function parseDiffLines(diff: string) {
  return diff.split("\n").map((line, i) => ({
    type: line.startsWith("@@")
      ? "hunk"
      : line.startsWith("+")
        ? "add"
        : line.startsWith("-")
          ? "del"
          : "ctx",
    content: line,
    lineNum: i + 1,
  }));
}

function markerFor(content: string) {
  if (content.startsWith("+")) return "+";
  if (content.startsWith("-")) return "-";
  return "";
}

function codeFor(content: string) {
  if (content.startsWith("+") || content.startsWith("-")) {
    return content.slice(1);
  }
  return content;
}

function FileIcon() {
  return (
    <svg className="file-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M4 1.75h5.25L13 5.5v8.75H4V1.75Zm5 1.5V6h2.75"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DiffSidebar({
  files,
  activeFile,
  referencedFile,
  onFileSelect,
  collapsed,
  onToggle,
}: DiffSidebarProps) {
  const active = files.find((file) => file.path === activeFile) ?? files[0];
  const lines = parseDiffLines(active?.diff ?? "");

  if (collapsed) {
    return (
      <aside className="sidebar collapsed">
        <button className="sidebar-toggle" type="button" onClick={onToggle}>
          →
        </button>
        <div className="collapsed-label">Diff context</div>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-label">Diff context</span>
        <button className="sidebar-toggle" type="button" onClick={onToggle}>
          ← hide
        </button>
      </div>
      <div className="file-tree">
        {files.map((file) => {
          const isActive = file.path === activeFile;
          const isReferenced =
            file.path.includes(referencedFile) || referencedFile.includes(file.path);

          return (
            <button
              className={`file-row${isActive ? " active" : ""}`}
              key={file.path}
              type="button"
              onClick={() => onFileSelect(file.path)}
              title={file.path}
            >
              <FileIcon />
              <span className="file-name">{file.path}</span>
              {isReferenced ? (
                <span className="mini-badge referenced">referenced</span>
              ) : (
                <span className="mini-badge">
                  +{file.additions} -{file.deletions}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="diff-view" aria-label={active?.path ?? "Diff"}>
        {lines.map((line) => (
          <div className={`diff-line diff-${line.type}`} key={line.lineNum}>
            <span className="diff-line-num">{line.lineNum}</span>
            <span>{markerFor(line.content)}</span>
            <span className="diff-code">{codeFor(line.content)}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
