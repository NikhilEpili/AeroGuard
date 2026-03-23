import AlertsPanel from "../components/AlertsPanel";

export default function Alerts({ user }) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          Air Quality Alerts
        </h2>
        <p className="text-gray-500 text-sm">
          Real-time pollution spikes and health risk warnings
        </p>
      </div>
      <AlertsPanel user={user} />
    </div>
  );
}