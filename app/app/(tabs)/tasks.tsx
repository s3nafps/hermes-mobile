import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function TasksScreen() {
  return (
    <PlaceholderScreen
      title="Tasks"
      screens={['Cron jobs', 'Cron editor', 'Kanban board', 'Kanban task', 'Goals and loops']}
    />
  );
}
