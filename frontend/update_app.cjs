const fs = require('fs');
let code = fs.readFileSync('c:/taskstaker/frontend/src/App.jsx', 'utf8');

const newReturn = `  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Network Warning */}
      {isWrongNetwork && (
        <div className="bg-orange-50 border-b border-orange-200 px-4 py-3">
          <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-orange-800 text-sm font-medium">
              <span>??</span>
              <p>You're on the wrong network ({network.name}). Need Local or Polygon Mumbai.</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 text-zinc-900">
              <Target size={28} strokeWidth={2} />
              <h1 className="text-xl font-semibold tracking-tight mt-1">
                TaskStaker
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm font-mono text-zinc-600 bg-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-200 flex items-center shadow-inner">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></span> {account.slice(0, 5)}...{account.slice(-4)}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-6">
          <CreateTask />
          <TaskList />
        </div>
      </main>
    </div>
  );`;

code = code.replace(/return \(\s*<div className="min-h-screen bg-gray-50">[\s\S]*?<\/div>\s*\);\s*}\s*export default App;/m, `${newReturn}\n}\n\nexport default App;`);

fs.writeFileSync('c:/taskstaker/frontend/src/App.jsx', code);
