import DataGrid from "./components/DataGrid";
import { employees, columns } from "./data/employees";
import "./App.css";

function App() {
  return (
    <main>
      <h1>Enterprise Employee Data Grid</h1>

      <p>
        Accessible employee management system
        following WCAG 2.2 Level AA.
      </p>

      <DataGrid
        data={employees}
        columns={columns}
        ariaLabel="Employee information grid"
      />
    </main>
  );
}

export default App;