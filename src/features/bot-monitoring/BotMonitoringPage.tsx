import { useParams } from 'react-router-dom';

export function BotMonitoringPage() {
  const { id } = useParams<{ id: string }>();
  return <div className="p-4 text-slate-200">Bot Monitoring: {id}</div>;
}
