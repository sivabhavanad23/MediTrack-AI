import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  categories: { category: string; units: number }[];
  expiry: { name: string; value: number }[];
  onInventory: () => void;
  onExpiry: () => void;
};

export default function DashboardCharts({
  categories,
  expiry,
  onInventory,
  onExpiry,
}: Props) {
  return (
    <div className="chart-grid">
      <section className="panel">
        <PanelHeading
          title="Stock by category"
          caption="Current units on hand"
          action="View inventory"
          onAction={onInventory}
        />
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categories}>
              <CartesianGrid vertical={false} stroke="#edf0ed" />
              <XAxis
                dataKey="category"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
              />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="units" fill="#2f7960" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="panel">
        <PanelHeading
          title="Expiry outlook"
          caption="Batches by time to expiry"
          action="Manage expiry"
          onAction={onExpiry}
        />
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={expiry}>
              <CartesianGrid vertical={false} stroke="#edf0ed" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                {expiry.map((entry, index) => (
                  <Cell
                    key={`${entry.name}-${index}`}
                    fill={["#d8943f", "#e3b768", "#a6b780", "#cb5b4c"][index]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

function PanelHeading({
  title,
  caption,
  action,
  onAction,
}: {
  title: string;
  caption: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="panel-heading">
      <div>
        <h3>{title}</h3>
        <p>{caption}</p>
      </div>
      <button className="text-action" onClick={onAction}>
        {action}
      </button>
    </div>
  );
}
