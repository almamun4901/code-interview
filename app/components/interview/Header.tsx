interface HeaderProps {
  repoFullName: string;
  commitSha: string;
  shortSha: string;
  commitMessage: string;
  currentQuestion: number;
  totalQuestions: number;
}

function truncateMessage(message: string) {
  return message.length > 50 ? `${message.slice(0, 49)}...` : message;
}

export function Header({
  repoFullName,
  commitSha,
  shortSha,
  commitMessage,
  currentQuestion,
  totalQuestions,
}: HeaderProps) {
  const href = `https://github.com/${repoFullName}/commit/${commitSha}`;
  const percent =
    totalQuestions > 0 ? Math.min(100, (currentQuestion / totalQuestions) * 100) : 0;

  return (
    <header className="app-header">
      <div className="app-logo">
        code<span>&gt;</span>interview
      </div>
      <div className="header-repo" title={repoFullName}>
        {repoFullName}
      </div>
      <a
        className="sha-badge"
        href={href}
        target="_blank"
        rel="noreferrer"
        title={commitSha}
      >
        {shortSha}
      </a>
      <div className="header-message" title={commitMessage}>
        {truncateMessage(commitMessage)}
      </div>
      <div className="header-spacer" />
      <div className="header-progress">
        <span className="progress-count">
          {currentQuestion} / {totalQuestions}
        </span>
        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </header>
  );
}
