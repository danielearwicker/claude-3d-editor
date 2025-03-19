import React, { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <h1>React Parcel App</h1>
      <div className="card">
        <button onClick={() => setCount(count + 1)}>
          Count is {count}
        </button>
        <p>
          Edit <code>src/App.js</code> and save to test HMR
        </p>
      </div>
    </div>
  );
}

export default App;
