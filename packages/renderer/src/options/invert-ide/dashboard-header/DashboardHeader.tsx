import "./DashboardHeader.scss";

export function DashboardHeader() {
  return (
    <header className="dashboard-header">
      <div className="dashboard-header--glow" aria-hidden="true" />
      <div className="dashboard-header--grid-pattern" aria-hidden="true" />
      <div className="dashboard-header--content">
        <div className="dashboard-header--code-snippet">
          <span className="dashboard-header--keyword">export</span>
          <span className="dashboard-header--keyword">function</span>
          <span className="dashboard-header--function">InvertUserscripts</span>
          <span className="dashboard-header--bracket">(</span>
          <span className="dashboard-header--param">doc</span>
          <span className="dashboard-header--punctuation">:</span>
          <span className="dashboard-header--type">Document</span>
          <span className="dashboard-header--bracket">)</span>
          <span className="dashboard-header--punctuation">:</span>
          <span className="dashboard-header--type">void</span>
          <span className="dashboard-header--bracket">{" {"}</span>
          <span className="dashboard-header--cursor" />
        </div>
      </div>
    </header>
  );
}
