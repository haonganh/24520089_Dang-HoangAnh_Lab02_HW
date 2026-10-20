import type { ColumnDef } from "../components/data-grid-contract";

export interface Employee {
  id: number;
  name: string;
  department: string;
  position: string;
  salary: number;
}

const names = [
  "Nguyen Van An", "Tran Thi Binh", "Le Minh Chau",
  "Pham Hoang Dung", "Vo Thi Giang", "Dang Quoc Huy",
  "Bui Ngoc Lan", "Ho Thi Mai", "Do Tuan Nam",
  "Ngo Thanh Phuc"
];

const departments = [
  "Engineering", "Marketing", "Finance",
  "Human Resources", "Operations"
];

const positions = [
  "Developer", "Designer", "Analyst",
  "Manager", "Specialist"
];

export const employees: Employee[] = Array.from(
  { length: 30 },
  (_, i) => ({
    id: i + 1,
    name: `${names[i % names.length]} ${Math.floor(i / names.length) + 1}`,
    department: departments[i % departments.length],
    position: positions[i % positions.length],
    salary: 1000 + i * 150,
  })
);

export const columns: ColumnDef<Employee>[] = [
  { header: "ID", accessorKey: "id", sortable: true },
  { header: "Full Name", accessorKey: "name", sortable: true },
  { header: "Department", accessorKey: "department", sortable: true },
  { header: "Position", accessorKey: "position" },
  { header: "Salary ($)", accessorKey: "salary", sortable: true },
];