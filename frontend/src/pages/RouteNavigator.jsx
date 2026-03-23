import MapNavigator from "../components/MapNavigator";

export default function RouteNavigator({ user }) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          AI Healthiest Route Navigator
        </h2>
        <p className="text-gray-500 text-sm">
          Find the route with least pollution exposure — powered by AI
        </p>
      </div>
      <MapNavigator user={user} />
    </div>
  );
}